<template>
  <div id="app">
    <StreamingAvatar />
  </div>
</template>

<script setup>
import StreamingAvatar from './components/StreamingAvatar.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background-color: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

#app {
  min-height: 100vh;
  padding: 20px;
}
</style>