<script setup>
import { customerConfig } from './config.js';
</script>

<template>
  <div class="min-h-screen">
    <header class="px-6 py-5 text-white" :style="{ backgroundColor: 'var(--primary-color)' }">
      <h1 class="text-xl font-semibold">Genesys Queue Analytics <span class="text-sm font-normal">v0.4.0 — migratie</span></h1>
    </header>
    <main class="mx-auto max-w-6xl p-6">
      <div class="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        De Vue-migratie is in ontwikkeling. Gebruik voor dagelijkse werkzaamheden voorlopig de stabiele versie op de main-branch.
      </div>
      <nav class="mt-6 flex gap-3" aria-label="Rapporttabbladen">
        <span class="rounded-md bg-white px-4 py-2 shadow-sm">Queues</span>
        <span v-if="customerConfig.showAgents" class="rounded-md bg-white px-4 py-2 shadow-sm">Agenten</span>
      </nav>
    </main>
  </div>
</template>
