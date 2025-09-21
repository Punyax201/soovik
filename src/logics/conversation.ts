// import { createParser } from 'eventsource-parser'
// import type { ParsedEvent, ReconnectInterval } from 'eventsource-parser'
import type { AxiosResponse } from 'axios'
import axios from 'axios'
import { updateConversationById } from '~/stores/conversation'
import { getMessagesByConversationId, pushMessageByConversationId } from '~/stores/messages'
import { setLoadingStateByConversationId, setStreamByConversationId } from '~/stores/streams'
import { currentErrorMessage } from '~/stores/ui'
import type { Conversation } from '~/types/conversation'
import type { ErrorMessage, Message } from '~/types/message'

export interface FetchPayload {
  apiKey: string
  baseUrl: string
  body: Record<string, any>
  signal?: AbortSignal
}

const baseUrl: string = 'https://rag-ai-test.onrender.com/ask'

export async function handlePrompt(conversation: Conversation, prompt?: string, signal?: AbortSignal) {
  if (!appSettings.value.apiKey) {
    // eslint-disable-next-line no-alert
    let apiKey = window.prompt('API Key')
    while (apiKey === null || apiKey.trim() === '') {
      // eslint-disable-next-line no-alert
      apiKey = window.prompt('API Key')
    }
    appSettings.value.apiKey = apiKey
  }

  if (prompt) {
    // pusm conversation
    pushMessageByConversationId(conversation.id, {
      id: `${conversation.id}:user:${Date.now()}`,
      role: 'user',
      content: prompt,
      created: new Date().getTime(),
    })
  }

  // set loading state
  setLoadingStateByConversationId(conversation.id, true)

  const allMessages = [
    ...getMessagesByConversationId(conversation.id).map(message => ({
      role: message.role,
      content: message.content,
    })),
  ]

  let messageHistorySize = 5
  let maxTokens = 2048
  const messages: Message[] = []
  while (messageHistorySize > 0) {
    messageHistorySize--
    // Get the last message from the payload
    const m = allMessages.pop()
    if (m === undefined)
      break

    if (maxTokens - m.content.length < 0)
      break

    maxTokens -= m.content.length
    messages.unshift(m)
  }

  const apiKey = `Bearer ${appSettings.value.apiKey}`

  let response
  try {
    response = await fetchChatCompletion({
      baseUrl: import.meta.env.VITE_BASE_URL,
      // apiKey: 'token 148eb236f0db8216c7cdf662fb5f9c039cdf0876',
      // baseUrl: 'https://openkey.cloud/v1',
      apiKey,
      body: {
        model: 'gpt-3.5-turbo',
        messages,
        stream: true,
        max_tokens: 2000,
        prompt: prompt || '',
      },
      signal,
    })
    if (response) {
      // console.log(response)
      if (!response.status) {
        const responseJson = response.data
        console.error('responseJson', responseJson)
        const errMessage = responseJson.error?.message || response.statusText || 'Unknown error'
        throw new Error(errMessage, { cause: responseJson.error })
      }

      // parse stream
      const stream = parseStream(response)
      // push message
      const messageId = `${conversation.id}:assistant:${Date.now()}`
      setStreamByConversationId(conversation.id, {
        messageId,
        stream,
      })

      pushMessageByConversationId(conversation.id, {
        id: messageId,
        role: 'assistant',
        content: '',
        streaming: true,
        created: new Date().getTime(),
      })

      setLoadingStateByConversationId(conversation.id, false)

      // Update conversation title
      updateConversationById(conversation.id, {
        name: prompt?.replace(/^['"\s]+|['"\s]+$/g, ''),
      })
    }
  }
  catch (e) {
    const error = e as Error
    const cause = error?.cause as ErrorMessage
    setLoadingStateByConversationId(conversation.id, false)
    if (error.name !== 'AbortError') {
      currentErrorMessage.set({
        code: cause?.code || 'provider_error',
        message: cause?.message || error.message || 'Unknown error',
      })
    }
  }
}

export async function fetchChatCompletion(payload: any) {
  const initOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': payload.apiKey,
      'Accept': 'text/event-stream',
    },
    method: 'POST',
    body: {
      query: payload.body.prompt,
      historical_context: payload.body.messages,
      max_tokens: payload.body.max_tokens,
      stream: payload.body.stream,
      model: payload.body.model,
    },
    // signal: payload.signal,
  }
  const response = await axios.post(baseUrl, initOptions.body, initOptions)
  return response
}

export function parseStream(rawResponse: AxiosResponse) {
  const encoder = new TextEncoder()
  // const decoder = new TextDecoder()
  // Axios returns response data as string, not ReadableStream
  const data = rawResponse.data as { answer: string, sources: any }

  return new ReadableStream({
    start(controller) {
      // Split data by newlines (each event)
      const lines = data.answer.split('\n')
      for (const line of lines) {
        if (!line.trim())
          continue
        if (line === '[DONE]') {
          controller.close()
          return
        }
        try {
          // const json = JSON.parse(line)
          // const text = json.choices?.[0]?.delta?.content || ''
          const queue = encoder.encode(line)
          controller.enqueue(queue)
        }
        catch (e) {
          controller.error(e)
        }
      }
      controller.close()
    },
  })
}
