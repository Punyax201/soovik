<script setup lang="ts">
import { suggestPrompt } from '~/stores/ui'

const suggestPrompts = [
  {
    id: 1,
    title: 'Export',
    content: 'What was India\'s net export to China in 2023-24?',
  },
]

function handleClick(content: string) {
  suggestPrompt.set(content)
}
</script>

<template>
  <div class="w-full p-2 md:p-4">
    <div class="max-w-base flex flex-col gap-2 md:(flex flex-row gap-4)">
      <!-- avatar -->
      <div class="h-8 w-8 fcc shrink-0 rounded-md bg-primary">
        <span class="c-white font-semibold">AI</span>
      </div>
      <!-- card -->
      <div class="mt-2 flex-1 rounded p-4 shadow-sm md:mt-0 bg-base">
        <div class="flex flex-col">
          <strong class="mb-2 text-26px font-600 lh-36px" />
          <p class="mb-6" />

          <div grid="~ md:cols-[1fr_1fr] gap-x-4 gap-y-4">
            <div v-for="item in suggestPrompts" :key="item.id" class="group flex flex-wrap" @click="handleClick(item.content)">
              <div class="cursor-pointer rd-md bg-#f6f8fd p-4 dark:bg-#2e2e30 group-hover:bg-primary/6">
                <div class="mb-4 fc gap-3">
                  <img src="../assets/crown.svg" alt="" class="h-21px w-23px">
                  <span class="lh-21px">{{ item.title }}</span>
                </div>
                <p class="line-clamp-3 break-words">
                  {{ item.content }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
