// ============================================================
// 📦 BOT CODE - HEXMODS KEY GEN
// ============================================================

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ============================================================
// 🔧 CONFIGURATIE - DIT MOET JE ZELF INVULLEN!
// ============================================================

// 👇 ZET HIER JE BOT TOKEN (van Discord Developer Portal)
const TOKEN = 'HIER_JE_BOT_TOKEN';

// 👇 ZET HIER DE ROLE ID DIE KEYS MAG GEVEN
// Hoe vind je role ID? Zie uitleg hieronder!
const ALLOWED_ROLE_ID = '1509683505624252498';

// 👇 Bestand waar de keys worden opgeslagen
const DATA_FILE = path.join(__dirname, 'keys.json');

// ============================================================
// 📁 DATA OPSLAG (JSON database)
// ============================================================

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('❌ Fout bij laden database:', error);
    }
    return { users: {} };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4));
    } catch (error) {
        console.log('❌ Fout bij opslaan database:', error);
    }
}

// ============================================================
// 🤖 BOT STARTEN
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
    ]
});

// ============================================================
// 📝 HELPERS
// ============================================================

function parseLength(lengthStr) {
    if (lengthStr.endsWith('d')) {
        return parseInt(lengthStr) * 24 * 60 * 60;
    } else if (lengthStr.endsWith('h')) {
        return parseInt(lengthStr) * 60 * 60;
    } else if (lengthStr.endsWith('m')) {
        return parseInt(lengthStr) * 60;
    }
    return null;
}

function formatTime(seconds) {
    if (seconds < 0) return 'VERLOPEN';
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
    return parts.join(' ');
}

function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${key.substring(0,4)}-${key.substring(4,8)}-${key.substring(8,12)}-${key.substring(12,16)}`;
}

// ============================================================
// 🎯 SLASH COMMANDS REGISTREREN
// ============================================================

const commands = [
    new SlashCommandBuilder()
        .setName('cs2cheat')
        .setDescription('Geef een CS2 Cheat key aan een gebruiker')
        .addStringOption(option =>
            option.setName('lengte')
                .setDescription('Hoe lang? (bv: 1d, 3h, 30m)')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('gebruiker')
                .setDescription('De gebruiker die de key krijgt')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check status van een gebruiker')
        .addUserOption(option =>
            option.setName('gebruiker')
                .setDescription('De gebruiker om te checken')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('keylist')
        .setDescription('Bekijk alle keys (admin only)'),
].map(command => command.toJSON());

// ============================================================
// 🚀 BOT START
// ============================================================

client.once('ready', async () => {
    console.log(`✅ Bot is online: ${client.user.tag}`);
    
    // Registreer slash commands
    try {
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Slash commands geregistreerd!');
    } catch (error) {
        console.error('❌ Fout bij registreren commands:', error);
    }
});

// ============================================================
// 📋 COMMAND HANDLER
// ============================================================

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    // ============================================================
    // /cs2cheat - KEY GEVEN
    // ============================================================
    if (commandName === 'cs2cheat') {
        // Check of gebruiker de juiste rol heeft
        const heeftRol = interaction.member.roles.cache.has(ALLOWED_ROLE_ID);
        if (!heeftRol) {
            return interaction.reply({
                content: '❌ Je hebt niet de juiste rol!',
                ephemeral: true
            });
        }

        const lengte = options.getString('lengte');
        const gebruiker = options.getUser('gebruiker');

        const seconds = parseLength(lengte);
        if (!seconds) {
            return interaction.reply({
                content: '❌ Gebruik: `1d` (dag), `3h` (uur), `30m` (minuut)',
                ephemeral: true
            });
        }

        if (seconds > 30 * 24 * 60 * 60) {
            return interaction.reply({
                content: '❌ Max 30 dagen!',
                ephemeral: true
            });
        }

        // Genereer key
        const key = generateKey();
        
        // Sla op in database
        const data = loadData();
        const userId = gebruiker.id;
        const expiry = new Date(Date.now() + seconds * 1000);
        
        data.users[userId] = {
            key: key,
            expiry: expiry.toISOString(),
            given_by: interaction.user.id,
            given_at: new Date().toISOString()
        };
        saveData(data);

        // Stuur bericht
        const embed = new EmbedBuilder()
            .setTitle('✅ Key Aangemaakt!')
            .setColor(0x00ff00)
            .addFields(
                { name: '👤 Gebruiker', value: `<@${gebruiker.id}>`, inline: true },
                { name: '🔑 Key', value: `\`${key}\``, inline: true },
                { name: '⏰ Verloopt', value: `<t:${Math.floor(expiry.getTime() / 1000)}:R>`, inline: true },
                { name: '📅 Duur', value: lengte, inline: true }
            );

        await interaction.reply({ embeds: [embed] });

        // Stuur DM naar gebruiker
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('🎯 CS2 Cheat Key')
                .setDescription('Je hebt een CS2 Cheat key ontvangen!')
                .setColor(0xffd700)
                .addFields(
                    { name: '🔑 Key', value: `\`${key}\`` },
                    { name: '⏰ Verloopt', value: `<t:${Math.floor(expiry.getTime() / 1000)}:R>` }
                );
            await gebruiker.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.log('⚠️ Kon geen DM sturen naar gebruiker');
        }
    }

    // ============================================================
    // /status - CHECK STATUS
    // ============================================================
    else if (commandName === 'status') {
        const gebruiker = options.getUser('gebruiker');
        const data = loadData();
        const userData = data.users[gebruiker.id];

        if (!userData) {
            return interaction.reply({
                content: `❌ <@${gebruiker.id}> heeft geen key.`,
                ephemeral: true
            });
        }

        const expiry = new Date(userData.expiry);
        const now = new Date();
        const isExpired = now > expiry;

        const embed = new EmbedBuilder()
            .setTitle(`📊 Status voor ${gebruiker.username}`)
            .setColor(isExpired ? 0xff0000 : 0x00ff00)
            .addFields(
                { name: '🔑 Key', value: `\`${userData.key}\`` },
                { name: '📅 Status', value: isExpired ? '❌ **VERLOPEN!**' : '✅ **Actief!**' }
            );

        if (!isExpired) {
            const remaining = Math.floor((expiry - now) / 1000);
            embed.addFields(
                { name: '⏰ Resterend', value: `**${formatTime(remaining)}**` },
                { name: '📅 Verloopt', value: `<t:${Math.floor(expiry.getTime() / 1000)}:F>` }
            );
        }

        await interaction.reply({ embeds: [embed] });
    }

    // ============================================================
    // /keylist - ALLE KEYS
    // ============================================================
    else if (commandName === 'keylist') {
        const heeftRol = interaction.member.roles.cache.has(ALLOWED_ROLE_ID);
        if (!heeftRol) {
            return interaction.reply({
                content: '❌ Alleen admins!',
                ephemeral: true
            });
        }

        const data = loadData();
        const now = new Date();
        let active = [];
        let expired = [];

        for (const [userId, userData] of Object.entries(data.users)) {
            const expiry = new Date(userData.expiry);
            try {
                const user = await client.users.fetch(userId);
                const name = user ? user.username : `Unknown (${userId})`;
                if (now > expiry) {
                    expired.push(`❌ ${name} - VERLOPEN`);
                } else {
                    const remaining = Math.floor((expiry - now) / 1000);
                    active.push(`✅ ${name} - ${formatTime(remaining)} left`);
                }
            } catch (error) {
                console.log(`⚠️ Kon gebruiker ${userId} niet ophalen`);
            }
        }

        let reply = '';
        if (active.length) {
            reply += '**🟢 Actieve keys:**\n' + active.join('\n');
        }
        if (expired.length) {
            if (reply) reply += '\n\n';
            reply += '**🔴 Verlopen keys:**\n' + expired.join('\n');
        }
        if (!reply) {
            reply = 'Geen keys gevonden.';
        }

        if (reply.length > 2000) {
            // Stuur als bestand als het te lang is
            const buffer = Buffer.from(reply, 'utf-8');
            await interaction.reply({ files: [{ attachment: buffer, name: 'keylist.txt' }] });
        } else {
            await interaction.reply({ content: reply });
        }
    }
});

// ============================================================
// 🚀 START DE BOT
// ============================================================

client.login(TOKEN);
