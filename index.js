const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const express = require('express');

ffmpeg.setFfmpegPath(ffmpegPath);

// ================= SERVER =================
const app = express();

app.get('/', (req, res) => {
    res.send('Bot ishlayapti ✅');
});

app.listen(process.env.PORT || 3000);

// ================= BOT =================
const bot = new TelegramBot(process.env.TOKEN, {
    polling: true
});

// ================= LANG STORAGE =================
let users = {};

// ================= TEXT SYSTEM =================
function text(lang) {

    // ===== UZ =====
    if (lang === 'uz') {
        return {
            welcome:
`🔥 Assalomu alaykum!

🎥 VideoSaveBot ga xush kelibsiz

Bu bot orqali:
⭕ Oddiy videolarni dumaloq video shakliga o'tkazishingiz mumkin

📹 Shunchaki video yuboring
🚀 Bot sizga tayyor dumaloq videoni yuboradi

😎 Bot guruhlarda ham ishlay oladi!`,

            loading:
`📥 Video aylantirilmoqda...
⏳ Iltimos biroz kuting`,

            success:
`✅ Video muvaffaqiyatli tayyorlandi`,

            error:
`❌ Server vaqtincha ishlamayapti
🔄 Iltimos keyinroq urinib ko‘ring`,

            select:
`🌍 Tilni tanlang`
        };
    }

    // ===== RU =====
    if (lang === 'ru') {
        return {
            welcome:
`🔥 Добро пожаловать!

🎥 VideoSaveBot

⭕ Этот бот превращает обычные видео в круглые видео Telegram

📹 Просто отправьте видео
🚀 И бот отправит готовое круглое видео

😎 Работает и в группах!`,

            loading:
`📥 Видео обрабатывается...
⏳ Пожалуйста подождите`,

            success:
`✅ Видео успешно готово`,

            error:
`❌ Сервер временно недоступен
🔄 Попробуйте позже`,

            select:
`🌍 Выберите язык`
        };
    }

    // ===== EN =====
    return {
        welcome:
`🔥 Welcome!

🎥 VideoSaveBot

⭕ Convert normal videos into Telegram round videos

📹 Just send a video
🚀 Bot will send round video instantly

😎 Works in groups too!`,

        loading:
`📥 Processing video...
⏳ Please wait`,

        success:
`✅ Video ready`,

        error:
`❌ Server temporarily unavailable
🔄 Please try again later`,

        select:
`🌍 Select language`
    };
}

// ================= START =================
bot.onText(/\/start/, (msg) => {

    bot.sendMessage(
        msg.chat.id,
        `🌍 Select Language / Tilni tanlang`, {
            reply_markup: {
                keyboard: [
                    ["🇺🇿 O'zbekcha"],
                    ["🇷🇺 Русский"],
                    ["🇺🇸 English"]
                ],
                resize_keyboard: true
            }
        }
    );

});

// ================= LANGUAGE =================
bot.on('message', async (msg) => {

    const chatId = msg.chat.id;
    const message = msg.text;

    if (!message) return;

    // ===== UZ =====
    if (message === "🇺🇿 O'zbekcha") {

        users[chatId] = "uz";

        return bot.sendMessage(
            chatId,
            text('uz').welcome
        );
    }

    // ===== RU =====
    if (message === "🇷🇺 Русский") {

        users[chatId] = "ru";

        return bot.sendMessage(
            chatId,
            text('ru').welcome
        );
    }

    // ===== EN =====
    if (message === "🇺🇸 English") {

        users[chatId] = "en";

        return bot.sendMessage(
            chatId,
            text('en').welcome
        );
    }

});

// ================= VIDEO HANDLER =================
bot.on('video', async (msg) => {

    const chatId = msg.chat.id;

    const lang = users[chatId] || 'en';

    try {

        bot.sendMessage(
            chatId,
            text(lang).loading
        );

        // ===== GET FILE =====
        const fileId = msg.video.file_id;

        const fileLink = await bot.getFileLink(fileId);

        // ===== FILE PATH =====
        const inputPath = `input_${chatId}.mp4`;
        const outputPath = `output_${chatId}.mp4`;

        // ===== DOWNLOAD =====
        const response = await fetch(fileLink);

        const buffer = await response.arrayBuffer();

        fs.writeFileSync(
            inputPath,
            Buffer.from(buffer)
        );

        // ===== FFMPEG =====
        ffmpeg(inputPath)

            .videoFilters([
                "crop='min(iw,ih)':'min(iw,ih)'",
                "scale=640:640"
            ])

            .outputOptions([
                '-c:v libx264',
                '-preset veryfast',
                '-crf 28'
            ])

            .save(outputPath)

            .on('end', async () => {

                // ===== SEND VIDEO NOTE =====
                await bot.sendVideoNote(
                    chatId,
                    outputPath
                );

                bot.sendMessage(
                    chatId,
                    text(lang).success
                );

                // ===== DELETE FILES =====
                if (fs.existsSync(inputPath)) {
                    fs.unlinkSync(inputPath);
                }

                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }

            })

            .on('error', async (err) => {

                console.log(err);

                bot.sendMessage(
                    chatId,
                    text(lang).error
                );

                // ===== DELETE =====
                if (fs.existsSync(inputPath)) {
                    fs.unlinkSync(inputPath);
                }

                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }

            });

    } catch (err) {

        console.log(err);

        bot.sendMessage(
            chatId,
            text(lang).error
        );

    }

});
