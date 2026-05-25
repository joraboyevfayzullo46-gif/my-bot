const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const express = require('express');
const https = require('https');

ffmpeg.setFfmpegPath(ffmpegPath);

// ================= SERVER =================
const app = express();
app.get('/', (req, res) => res.send('Bot ishlayapti ✅'));
app.listen(process.env.PORT || 3000);

// ================= BOT =================
const bot = new TelegramBot(process.env.TOKEN, { polling: true });

// ================= STORAGE =================
let users = {};
let videoData = {};

// ================= TEXT =================
function text(lang) {
    const t = {
        uz: {
            start: "Assalomu alaykum @yumaloqdumaloqbot ga xush kelibsiz",
            welcome: "🔥 Xush kelibsiz!",
            settings: "⚙️ Sozlamalar",
            more: "➕ Qo‘shimcha funksiyalar",
            quality: "🎚 Sifatni tanlang",
            loading: "⏳ Ishlanmoqda...",
            done: "✅ Tayyor!",
            error: "❌ Xatolik"
        },
        en: {
            start: "👋 Hello!\n\n🎥 Send video",
            welcome: "🔥 Welcome!",
            settings: "⚙️ Settings",
            more: "➕ More features",
            quality: "🎚 Select quality",
            loading: "⏳ Processing...",
            done: "✅ Done!",
            error: "❌ Error"
        }
    };

    return t[lang] || t.en;
}

// ================= KEYBOARDS =================
function langMenu() {
    return {
        inline_keyboard: [
            [{ text: "🇺🇿 Uzbek", callback_data: "lang_uz" }],
            [{ text: "🇺🇸 English", callback_data: "lang_en" }]
        ]
    };
}

function mainMenu(lang) {
    return {
        reply_markup: {
            keyboard: [
                [text(lang).settings],
                [text(lang).more]
            ],
            resize_keyboard: true
        }
    };
}

function moreMenu(lang) {
    return {
        inline_keyboard: [
            [{ text: "✂️ Trim", callback_data: "trim" }],
            [{ text: "🎵 MP3", callback_data: "mp3" }],
            [{ text: "🖼 Watermark", callback_data: "wm" }],
            [{ text: "📦 Compress", callback_data: "comp" }],
            [{ text: "📱 9:16 TikTok", callback_data: "tiktok" }]
        ]
    };
}

function qualityMenu() {
    return {
        inline_keyboard: [
            [{ text: "📺 360p", callback_data: "q_360" }],
            [{ text: "📺 480p", callback_data: "q_480" }],
            [{ text: "📺 720p", callback_data: "q_720" }]
        ]
    };
}

// ================= START =================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        "👋 Hello / Salom\n🌍 Tilni tanlang",
        { reply_markup: langMenu() }
    );
});

// ================= SETTINGS / MENU =================
bot.on('message', (msg) => {

    const chatId = msg.chat.id;
    const lang = users[chatId] || 'en';

    if (msg.text === text(lang).settings) {
        return bot.sendMessage(chatId, "🌍 Select language", {
            reply_markup: langMenu()
        });
    }

    if (msg.text === text(lang).more) {
        return bot.sendMessage(chatId, "➕ Features", {
            reply_markup: moreMenu(lang)
        });
    }
});

// ================= LANGUAGE =================
bot.on('callback_query', async (q) => {

    const chatId = q.message.chat.id;
    const data = q.data;

    // 🌍 LANG
    if (data.startsWith("lang_")) {
        const lang = data.split("_")[1];
        users[chatId] = lang;

        await bot.answerCallbackQuery(q.id);

        return bot.sendMessage(chatId, text(lang).welcome, mainMenu(lang));
    }

    // 🎬 SAVE ACTION
    if (['trim','mp3','wm','comp','tiktok'].includes(data)) {
        videoData[chatId].action = data;
        return bot.sendMessage(chatId, "🎚 Sifat tanlang", {
            reply_markup: qualityMenu()
        });
    }

    // 🎚 QUALITY
    if (data.startsWith("q_")) {
        const ql = data.split("_")[1];
        videoData[chatId].quality = ql;

        return bot.sendMessage(chatId, "📥 Video yuboring");
    }

    bot.answerCallbackQuery(q.id);
});

// ================= VIDEO =================
bot.on('video', async (msg) => {

    const chatId = msg.chat.id;
    const lang = users[chatId] || 'en';

    const fileId = msg.video.file_id;
    const fileLink = await bot.getFileLink(fileId);

    const input = `in_${chatId}.mp4`;
    const output = `out_${chatId}.mp4`;

    videoData[chatId] = {
        action: 'circle',
        quality: 720
    };

    bot.sendMessage(chatId, "⏳ Processing... 0%");

    const file = fs.createWriteStream(input);

    https.get(fileLink, (res) => {
        res.pipe(file);

        file.on('finish', () => {

            bot.sendMessage(chatId, "⏳ 40%");

            const action = videoData[chatId].action;

            let cmd = "";

            if (action === "circle") {
                cmd = `-vf "crop='min(iw,ih)':'min(iw,ih)',scale=640:640"`;
            }

            if (action === "tiktok") {
                cmd = `-vf "scale=720:1280"`;
            }

            if (action === "mp3") {
                cmd = `-vn`;
            }

            if (action === "wm") {
                cmd = `-vf "drawtext=text='@Bot':x=10:y=10"`;
            }

            if (action === "comp") {
                cmd = `-crf 32`;
            }

            ffmpeg(input)
                .outputOptions(cmd)
                .save(output)
                .on('progress', () => {
                    bot.sendMessage(chatId, "⏳ 70%");
                })
                .on('end', async () => {

                    bot.sendMessage(chatId, "⏳ 100%");

                    if (action === "mp3") {
                        await bot.sendAudio(chatId, output);
                    } else {
                        await bot.sendVideoNote(chatId, output);
                    }

                    bot.sendMessage(chatId, "✅ Done!");

                    fs.unlinkSync(input);
                    fs.unlinkSync(output);
                })
                .on('error', (err) => {
                    console.log(err);
                    bot.sendMessage(chatId, "❌ Error");
                });

        });
    });
});
