<template>
    <div class="left">
        Score: {{ score }}
    </div>
</template>

<style scoped>
.left {
    position: absolute;
    top: 40%;
    left: 2%;
    width: 20%;
    height: 10%;
    background-color: #ace5ff;
    color: #fff;
    display: flex;
    justify-content: center; /* 水平居中 */
    align-items: center; /* 垂直居中 */
    padding: 10px;
    border-radius: 10px;
    transform: translateY(-50%); /* 垂直居中 */
    font-family: 'Source Han Sans CN', sans-serif;
    font-size: 40px;
    font-weight: 700;
    line-height: 1.5;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    transition: all 0.5s;
}
</style>

<script>
export default {
    props: {
        score: {
            type: Number,
            required: true
        }
    }
}
</script>