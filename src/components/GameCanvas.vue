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
    top: 55%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 65%;
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
    PoseLandmarker,
    FilesetResolver,
    DrawingUtils,
    FaceDetector
} from "@mediapipe/tasks-vision";

export default {
    props: {
        score: Number,
    },
    data() {
        return {
            moving_speed: 150, // 障碍物移动速度
            generate_interval: 2500, // 障碍物生成间隔
            lastFrameTime: performance.now(), // 上一帧的时间
            drawUtilsLoaded: false, // drawing_utils 是否已加载
            runningMode: "VIDEO", // 运行模式
            webcamRunning: true, // 摄像头是否正在运行
            results: undefined, // 识别结果
            faceDetector: undefined, // 人脸识别器
            faceResults: undefined, // 人脸识别结果
            faceBox: undefined, // 人脸框, 包含height, originX, originY, width
            submarine_x: 0, // 潜艇的x坐标
            submarine_y: 0, // 潜艇的y坐标
            canvas_size: { width: 100, height: 100 }, // 画布大小
            // 一些图片资源
            backgroundImage: null, // 背景图片
            submarineImage: null, // 潜艇图片
            barrierImage: null, // 障碍物图片
            barriers: [], // 障碍物数组
            gameOver: false, // 游戏结束标志
            score: 0, // 得分
            // 姿态识别结果
            poseResults: undefined,
            isRightHandRaised: false,
            // 游戏已经开始了多久
            gameStartTime: 0,
            // 上次生成障碍物的时间
            lastGenerateTime: 0
        }
    },
    mounted() {
        this.loadDrawingUtils();
        this.createFaceDetector();
        this.createPoseLandmarker();
        this.enableCam();
        this.loadImage();
        this.startGeneratingBarriers();
        this.lastFrameTime = performance.now(); // 初始化 lastFrameTime
        window.addEventListener('keydown', this.handleRestart); // 添加键盘事件监听器
        // 添加变量监听器，当isRightHandRaised: ture调用this.handleRestart
        this.$watch(() => this.isRightHandRaised, (newVal) => {
            if (newVal) {
                this.handleRestart({ key: 'r' });
            }
        });
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
        async createPoseLandmarker() {
            const vision = await FilesetResolver.forVisionTasks(
                "/DeepOceanAdventure/wasm"
            );
            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `/DeepOceanAdventure/pose_landmarker_lite.task`,
                    delegate: "GPU"
                },
                runningMode: this.runningMode,
                numPoses: 1
            });
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
        startGeneratingBarriers() {
            setInterval(() => {
                if (!this.gameOver) {
                    this.generateBarrier();
                }
            }, 100);
        },
        generateBarrier() {
            // 随机生成障碍物
            if (!this.barrierImage) {
                return; // 图片未加载完成，不生成障碍物
            }
            const currentTime = performance.now();
            // 距离上次生成障碍物的时间大于生成间隔时才生成障碍物
            if (currentTime - this.lastGenerateTime < this.generate_interval) {
                return;
            }
            this.lastGenerateTime = currentTime;
            const canvas = this.$refs.canvas;
            const barrier = {
                x: canvas.width * (Math.random()*0.5+0.25) - this.barrierImage.width / 2,
                y: canvas.height,
                width: this.barrierImage.width,
                height: this.barrierImage.height
            };
            this.barriers.push(barrier);
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
                
                // 如果游戏结束了就不检测人脸了
                if (!this.gameOver) {
                    // 将翻转后的图像数据传递给faceDetector进行检测
                    this.faceResults = await this.faceDetector.detectForVideo(video, startTimeMs);
                }
                else{
                    this.poseResults = await this.poseLandmarker.detectForVideo(video, startTimeMs);
                    // 检查右手是否举起
                    this.checkRightHandRaised(this.poseResults);
                }
            }

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height); // 清空画布

            // 绘制背景图片
            if (this.backgroundImage) {
                canvasCtx.drawImage(this.backgroundImage, 0, canvas.height*2/3, canvas.width, canvas.height/3);
            }

            // 绘制人脸关键点和计算潜艇应该在什么位置
            if (this.faceResults && this.faceResults.detections && this.faceResults.detections.length > 0) {
                // this.drawFaceDetections(canvasCtx, this.faceResults.detections);
                // 直接把潜艇画到人脸的中心位置
                // 选取bounding box的中心作为潜艇的位置
                this.faceBox = this.faceResults.detections[0].boundingBox;
            }

            const centerX = canvas.width - (this.faceBox.originX + this.faceBox.width / 2);
            const centerY = (this.faceBox.originY + this.faceBox.height / 2);
            this.submarine_x = centerX;
            this.submarine_y = centerY;
            const submarineWidth = this.faceBox.width * 0.5;
            const submarineHeight = this.faceBox.height * 0.5;
            canvasCtx.drawImage(this.submarineImage, centerX - submarineWidth / 2, centerY - submarineHeight / 2, submarineWidth, submarineHeight);

            // 计算时间间隔
            const currentTime = performance.now();
            const deltaTime = (currentTime - this.lastFrameTime) / 1000; // 计算时间间隔（秒）
            this.lastFrameTime = currentTime;

            // 绘制并移动障碍物
            const toRemove = []; // 临时数组，用于存储需要删除的障碍物的索引
            this.barriers.forEach((barrier, index) => {
                barrier.y -= this.moving_speed * deltaTime;
                canvasCtx.drawImage(this.barrierImage, barrier.x, barrier.y, barrier.width, barrier.height);
                // 检查碰撞
                if (this.checkCollision(barrier, centerX, centerY, submarineWidth, submarineHeight)) {
                    this.gameOver = true;
                }
                // 标记超出画布的障碍物
                if (barrier.y + barrier.height < -100) {
                    toRemove.push(index);
                    this.score += 1;
                }
            });

            // 统一删除标记的障碍物
            toRemove.reverse().forEach(index => {
                this.barriers.splice(index, 1);
            });

            // 游戏结束时绘制弹窗
            if (this.gameOver) {
                this.moving_speed = 0; // 游戏结束时停止移动
                this.generate_interval = 999999; // 游戏结束时停止生成障碍物

                canvasCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
                canvasCtx.fillRect(canvas.width / 4, canvas.height / 4, canvas.width / 2, canvas.height / 2);

                canvasCtx.fillStyle = "red";
                canvasCtx.font = "30px Arial";
                canvasCtx.textAlign = "center";
                canvasCtx.fillText("游戏结束", canvas.width / 2, canvas.height / 2 - 20);

                canvasCtx.fillStyle = "white";
                canvasCtx.font = "20px Arial";
                canvasCtx.fillText(`分数：${this.score}`, canvas.width / 2, canvas.height / 2 + 20);
                canvasCtx.fillText("举右手重新开始游戏", canvas.width / 2, canvas.height / 2 + 60);
            }
            else{
                this.moving_speed = 150 + this.score * 4; // 随着得分增加，障碍物移动速度增加
                const generate_interval = 2500*150/this.moving_speed; // 随着得分增加，障碍物生成间隔减少
                this.generate_interval = generate_interval < 500 ? 500 : generate_interval; // 生成间隔最小为500ms
            }

            canvasCtx.restore(); // 恢复上下文状态

            // 在左上角绘制得分
            canvasCtx.fillStyle = "black";
            canvasCtx.font = "20px Arial";
            canvasCtx.fillText(`Score: ${this.score}`, 20, 30);


            // Call this function again to keep predicting when the browser is ready.
            if (this.webcamRunning) {
                window.requestAnimationFrame(this.predictWebcam);
            }
        },
        checkRightHandRaised(results) {
            if (results && results.landmarks[0]) {
                const rightWrist = results.landmarks[0][16];
                const rightElbow = results.landmarks[0][0];
                if (rightWrist && rightElbow && rightWrist.y < rightElbow.y) {
                    this.isRightHandRaised = true;
                }
            }
        },
        handleRestart(event) {
            if (event.key === 'r' || event.key === 'R') {
                if (this.gameOver) {
                    this.isRightHandRaised = false;
                    this.resetGame();
                }
            }
        },
        resetGame() {
            this.gameOver = false;
            this.score = 0;
            this.barriers = [];
            this.lastFrameTime = performance.now();
            this.predictWebcam();
        },
        checkCollision(barrier, submarineX, submarineY, submarineWidth, submarineHeight) {
            const rect1 = {
                x: barrier.x,
                y: barrier.y,
                width: barrier.width*951/2162, // 障碍物图片可能缩放，使用比例计算
                height: barrier.height
            };
            const rect2 = {
                x: barrier.x + barrier.width*1187/2162,
                y: barrier.y,
                width: barrier.width*(2162-1187)/2162,
                height: barrier.height
            };
            const submarine_rect = {
                x: submarineX - submarineWidth / 2,
                y: submarineY - submarineHeight / 2,
                width: submarineWidth,
                height: submarineHeight
            };
            // 检查潜艇是否不与障碍物1碰撞
            const not_collide_with_rect1 = (
                submarine_rect.x > rect1.x + rect1.width || // 潜艇的左边界在障碍物的右边界右侧
                submarine_rect.x + submarine_rect.width < rect1.x || // 潜艇的右边界在障碍物的左边界左侧
                submarine_rect.y > rect1.y + rect1.height || // 潜艇的上边界在障碍物的下边界下侧
                submarine_rect.y + submarine_rect.height < rect1.y // 潜艇的下边界在障碍物的上边界上侧
            );
            // 检查潜艇是否不与障碍物2碰撞
            const not_collide_with_rect2 = (
                submarine_rect.x > rect2.x + rect2.width || // 潜艇的左边界在障碍物的右边界右侧
                submarine_rect.x + submarine_rect.width < rect2.x || // 潜艇的右边界在障碍物的左边界左侧
                submarine_rect.y > rect2.y + rect2.height || // 潜艇的上边界在障碍物的下边界下侧
                submarine_rect.y + submarine_rect.height < rect2.y // 潜艇的下边界在障碍物的上边界上侧
            );
            return !not_collide_with_rect1 || !not_collide_with_rect2;
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
    },
    beforeDestroy() {
        window.removeEventListener('keydown', this.handleRestart); // 移除键盘事件监听器
    }
}
</script>