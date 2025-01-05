<template>
    <div class="top">
        <div class="camera-container">
            <!-- 视频流显示 -->
            <video ref="video" class="camera-feed" autoplay></video>
            <!-- 画布用于绘制手势识别结果 -->
            <canvas ref="canvas" class="camera-overlay"></canvas>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { FilesetResolver, DrawingUtils, FaceDetector } from "@mediapipe/tasks-vision";

const canvas = ref(null);
const ctx = ref(null);
const faceDetector = ref(null);
const drawUtilsLoaded = ref(false);
const gameStarted = ref(false);
const pause = ref(false);
const score = ref(0);
const x = ref(200);
const y = ref(260);
const pipeArray = ref([]);
const pipeSpeed = ref(1);

const canvasWidth = 640;
const canvasHeight = 480;
const playerWidth = 50;
const playerHeight = 50;
const gapDis = 150;
const pipesDis = 200;
const pipeWidth = 51;
const pipeHeight = 317;
const baseWidth = 400;
const baseHeight = 200;

const bg = new Image();
const playerSprite = new Image();
const pipeTop = new Image();
const pipeBottom = new Image();
const base = new Image();

bg.src = "";
pipeTop.src = "/DeepOceanAdventure/assets/pipe-red-top.png";
pipeBottom.src = "/DeepOceanAdventure/assets/pipe-red-bottom.png";
playerSprite.src = "/DeepOceanAdventure/assets/submarine.png";
base.src = "/DeepOceanAdventure/assets/base.png";

const loadDrawingUtils = async () => {
    const script = document.createElement("script");
    script.src = "/DeepOceanAdventure/drawing_utils.js";
    script.onload = () => {
        drawUtilsLoaded.value = true;
    };
    document.head.appendChild(script);
};

const createFaceDetector = async () => {
    const vision = await FilesetResolver.forVisionTasks("/DeepOceanAdventure/wasm");
    faceDetector.value = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `/DeepOceanAdventure/blaze_face_short_range.tflite`,
            delegate: "GPU"
        },
        runningMode: "VIDEO"
    });
};

const enableCam = () => {
    const constraints = { video: true };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    });
};

const predictWebcam = () => {
    // Add face detection logic here
};

const pipe = (p_x, p_y) => {
    return {
        p_x,
        p_y,
        scored: 0,
        update() {
            if (this.p_x <= -pipeWidth) {
                this.p_x = (canvasWidth - pipeWidth);
                this.p_y = -1 * (Math.random() * 200) - 75;
                this.scored = 0;
                pipeSpeed.value += 0.1;
            }
        },
        collide() {
            if ((x.value + playerWidth >= this.p_x) && (x.value <= (this.p_x + pipeWidth)) && (y.value <= (this.p_y + pipeHeight))) {
                pause.value = true;
                gameStarted.value = false;
            } else if ((x.value + playerWidth >= this.p_x) && (x.value <= (this.p_x + pipeWidth)) && (y.value + playerHeight >= (this.p_y + pipeHeight + gapDis))) {
                pause.value = true;
                gameStarted.value = false;
            } else if ((y.value + playerHeight) >= canvasHeight) {
                pause.value = true;
                gameStarted.value = false;
            } else if (y.value <= 0) {
                pause.value = true;
                gameStarted.value = false;
            } else if (x.value <= 0) {
                pause.value = true;
                gameStarted.value = false;
            } else if ((x.value + playerWidth) >= canvasHeight) {
                pause.value = true;
                gameStarted.value = false;
            }
        },
        score() {
            if (x.value > (this.p_x + pipeWidth) && (y.value > (this.p_y + pipeHeight)) && (y.value < (this.p_y + pipeHeight + gapDis)) && this.scored === 0) {
                score.value++;
                this.scored = 1;
            }
        }
    };
};

const pipePosition = (i) => {
    const p_x = canvasWidth + i * pipesDis;
    const p_y = -1 * (Math.random() * 170);
    pipeArray.value.push(pipe(p_x, p_y));
};

for (let i = 0; i < 3; i++) {
    pipePosition(i);
}

const draw = () => {
    ctx.value.drawImage(bg, 0, 0, canvasWidth, canvasHeight);
    if (gameStarted.value && !pause.value) {
        ctx.value.drawImage(playerSprite, x.value, y.value, playerWidth, playerHeight);
        for (let j = 0; j < pipeArray.value.length; j++) {
            pipeArray.value[j].update();
            ctx.value.drawImage(pipeTop, pipeArray.value[j].p_x, pipeArray.value[j].p_y, pipeWidth, pipeHeight);
            ctx.value.drawImage(pipeBottom, pipeArray.value[j].p_x, pipeArray.value[j].p_y + pipeHeight + gapDis, pipeWidth, pipeHeight + gapDis);
            pipeArray.value[j].collide();
            pipeArray.value[j].score();
            pipeArray.value[j].p_x -= pipeSpeed.value;
        }
        ctx.value.drawImage(base, 0, canvasHeight - baseHeight, canvasWidth, baseHeight);
        ctx.value.fillStyle = '#FF2D00';
        ctx.value.font = '25px Arial';
        ctx.value.fillText("Score: " + score.value, 20, 50);
    } else if (!gameStarted.value && !pause.value) {
        ctx.value.fillStyle = "#000000";
        ctx.value.globalAlpha = 0.6;
        ctx.value.fillRect(70, 180, 250, 150);
        ctx.value.globalAlpha = 1;
        ctx.value.font = "17px Arial";
        ctx.value.fillStyle = "#FF0000";
        ctx.value.fillText("举手开始游戏", 130, 260);
    }

    if (pause.value) {
        ctx.value.fillStyle = "#000000";
        ctx.value.globalAlpha = 0.6;
        ctx.value.fillRect(70, 180, 250, 150);
        ctx.value.globalAlpha = 1;
        ctx.value.fillStyle = "#FF0000";
        ctx.value.font = "25px Arial";
        ctx.value.fillText("游戏结束", 130, 220);
        ctx.value.font = "17px Arial";
        ctx.value.fillStyle = "#FFFFFF";
        ctx.value.fillText("分数 : " + score.value, 130, 260);
        ctx.value.fillText("举手返回开始", 130, 290);
    }

    requestAnimationFrame(draw);
};

onMounted(() => {
    ctx.value = canvas.value.getContext('2d');
    canvas.value.width = canvasWidth;
    canvas.value.height = canvasHeight;
    loadDrawingUtils();
    createFaceDetector();
    enableCam();
    draw();
});
</script>

<style scoped>
.top {
    position: absolute;
    top: 10%;
    width: 100%;
    height: 87%;
    left: 0%;
}
</style>