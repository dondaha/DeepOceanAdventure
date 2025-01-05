<template>
    <div class="top">
        <div class="camera-container">
            <!-- 视频流显示 -->
            <video ref="video" class="camera-feed" autoplay style="transform: scaleX(-1);"></video>
            <!-- 画布用于绘制手势识别结果 -->
            <canvas ref="canvas" class="camera-overlay"></canvas>
        </div>
    </div>
</template>

<style scoped>
.top {
    position: absolute;
    top: 25%;
    left: 25%;
    width: 45%;
    height: 68%;
    background-color: #c0e3ff;
    border-radius: 5%;
    overflow: hidden;
    /* 内部board */
    box-shadow: 0 0 10px 5px rgba(0, 0, 0, 0.1);
}



.camera-container {
    position: relative;
    top: 0%;
    left: 0%;
    width: 100%;
    height: 100%;
}

.camera-feed {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
    /* 居中 */
    margin: auto;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
}

.camera-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
</style>

<script>
import {
    FilesetResolver,
    DrawingUtils,
    FaceDetector
} from "@mediapipe/tasks-vision";

export default {
    props: {

    },
    data() {
        return {
            drawUtilsLoaded: false, // drawing_utils 是否已加载
            runningMode: "VIDEO", // 运行模式
            webcamRunning: true, // 摄像头是否正在运行
            results: undefined, // 识别结果
            faceDetector: undefined, // 人脸识别器
            faceResults: undefined, // 人脸识别结果
        }
    },
    mounted() {
        this.loadDrawingUtils();
        this.createFaceDetector();
        this.enableCam();
    },
    methods: {
        async loadDrawingUtils() {
            const script = document.createElement("script");
            script.src = "/DeepOceanAdventure/drawing_utils.js";
            script.onload = () => {
                this.drawUtilsLoaded = true;
            };
            document.head.appendChild(script);
        },
        async createFaceDetector() {
            const vision = await FilesetResolver.forVisionTasks(
                "/DeepOceanAdventure/wasm"
            );
            this.faceDetector = await FaceDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `/DeepOceanAdventure/blaze_face_short_range.tflite`,
                    delegate: "GPU"
                },
                runningMode: this.runningMode
            });
        },
        enableCam() {
            const constraints = {
                video: true
            };
            navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
                this.$refs.video.srcObject = stream;
                this.$refs.video.addEventListener("loadeddata", this.predictWebcam);
            });
        },
        async predictWebcam() {
            if (!this.drawUtilsLoaded || !this.faceDetector) {
                requestAnimationFrame(this.predictWebcam);
                return;
            }
            const video = this.$refs.video;
            // 可视化画布
            const canvas = this.$refs.canvas;
            const canvasCtx = canvas.getContext("2d");

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            if (this.runningMode === "IMAGE") {
                this.runningMode = "VIDEO";
                await this.faceDetector.setOptions({ runningMode: "VIDEO" });
            }

            const startTimeMs = performance.now();
            if (this.lastVideoTime !== video.currentTime) {
                this.lastVideoTime = video.currentTime;
                // 获取翻转后的图像数据
                canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
                // 将翻转后的图像数据传递给faceDetector进行检测
                this.faceResults = await this.faceDetector.detectForVideo(imageData, startTimeMs);
            }

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height); // 清空画布

            // 绘制人脸关键点
            if (this.faceResults && this.faceResults.detections) {
                this.drawFaceDetections(canvasCtx, this.faceResults.detections);
            }

            canvasCtx.restore(); // 恢复上下文状态

            // Call this function again to keep predicting when the browser is ready.
            if (this.webcamRunning) {
                window.requestAnimationFrame(this.predictWebcam);
            }
        },
        drawFaceDetections(ctx, detections) {
            for (const detection of detections) {
                const keypoints = detection.keypoints;
                const boundingBox = detection.boundingBox;
                // 绘制关键点和标号
                ctx.fillStyle = "red";
                ctx.font = "10px Arial";
                keypoints.forEach((keypoint, index) => {
                    // 水平翻转关键点的 x 坐标
                    const x = (1 - keypoint.x) * ctx.canvas.width;
                    const y = keypoint.y * ctx.canvas.height;
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.fillText(index, x + 5, y - 5);
                });
            }
        },
    }
}
</script>