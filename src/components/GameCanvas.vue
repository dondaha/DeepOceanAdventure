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
    top: 20%;
    left: 25%;
    width: 45%;
    height: 75%;
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
    width: 100%;
    height: 100%;
    object-fit: fill; /* fill: 填满空间但可能形变，contain: 保持比例但留有空白，cover: 保持比例但填满 */
    display: block;
    position: absolute;
    top: 0;
    left: 0;
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
            faceBox: undefined, // 人脸框, 包含height, originX, originY, width
            submarine_x: 0, // 潜艇的x坐标
            submarine_y: 0, // 潜艇的y坐标
            // 一些图片资源
            backgroundImage: null, // 背景图片
            submarineImage: null, // 潜艇图片
            barrierImage: null, // 障碍物图片
        }
    },
    mounted() {
        this.loadDrawingUtils();
        this.createFaceDetector();
        this.enableCam();
        this.loadImage();
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
        loadImage() {
            // 加载背景图片
            const img = new Image();
            img.src = "/DeepOceanAdventure/assets/base.png";
            img.onload = () => {
                this.backgroundImage = img;
            };
            // 加载潜艇图片
            const submarineImg = new Image();
            submarineImg.src = "/DeepOceanAdventure/assets/submarine.png";
            submarineImg.onload = () => {
                this.submarineImage = submarineImg;
            };
            // 加载障碍物图片
            const barrierImg = new Image();
            barrierImg.src = "/DeepOceanAdventure/assets/227975925.png";
            barrierImg.onload = () => {
                this.barrierImage = barrierImg;
            };
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

            // 绘制背景图片
            if (this.backgroundImage) {
                canvasCtx.drawImage(this.backgroundImage, 0, canvas.height*2/3, canvas.width, canvas.height/3);
            }

            // 绘制人脸关键点和计算潜艇应该在什么位置
            if (this.faceResults && this.faceResults.detections && this.faceResults.detections.length > 0) {
                this.drawFaceDetections(canvasCtx, this.faceResults.detections);
                // 直接把潜艇画到人脸的中心位置
                // 选取bounding box的中心作为潜艇的位置
                console.log(this.faceResults.detections[0].boundingBox);
                this.faceBox = this.faceResults.detections[0].boundingBox;
            }

            const centerX = canvas.width - (this.faceBox.originX + this.faceBox.width / 2);
            const centerY = (this.faceBox.originY + this.faceBox.height / 2);
            this.submarine_x = centerX;
            this.submarine_y = centerY;
            const submarineWidth = this.faceBox.width * 0.5;
            const submarineHeight = this.faceBox.height * 0.5;
            canvasCtx.drawImage(this.submarineImage, centerX - submarineWidth / 2, centerY - submarineHeight / 2, submarineWidth, submarineHeight);

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