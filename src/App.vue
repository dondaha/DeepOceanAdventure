<template>
  <div id="app">
    <GameCanvas />
  </div>
</template>

<script setup>
import GameCanvas from './components/GameCanvas.vue';
</script>

<style>
@import './asset/main.css';

* {
  margin: 0;
  padding: 0;
}

body {
  /* width: 1600px;
    height: 960px; */
  width: 100vw;
  height: 100vh;
  background-image: url("./asset/bgc_landscape.jpg");
  background-size: 100%;
  background-position: center center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  /* 默认背景颜色 */
  background-color: #BEE1FF;
}

.top {
  position: absolute;
  top: 10%;
  width: 100%;
  height: 87%;
  left: 0%;
  /* border: 1px solid red; */
}

#canvas {
  top: 10%;
  width: 80%;
  height: 90%;
}

</style>