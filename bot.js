import discord
from discord import app_commands
from discord.ext import commands
import json
import os
import datetime
import secrets
import string

# ============================================================
# 🔧 CONFIGURATIE - VUL DIT IN!
# ============================================================

# 👇 ZET HIER JE BOT TOKEN (van Discord Developer Portal)
TOKEN = "MTUxMjU0NTg0NTAzNDM1Mjg2MQ.Gd8BEG.Ztw4n_3KCA_2iTFwkAsQ5Bp0JZtmd455m7jd1c"

# 👇 ZET HIER DE ROLE ID DIE KEYS MAG GEVEN
# Hoe vind je role ID? Zie uitleg hieronder!
ALLOWED_ROLE_ID = 1509683505624252498

# ============================================================
# 📁 DATA OPSLAG (JSON database - geen ingewikkelde dingen!)
# ============================================================

DATA_FILE = "/data/keys.json"

def load_data():
    """Laad de database"""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {"users": {}}

def save_data(data):
    """Sla de database op"""
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

# ============================================================
# 🤖 BOT STARTEN
# ============================================================

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

# ============================================================
# 📝 HELPERS
# ============================================================

def parse_length(length_str):
    """Zet '1d' om naar seconden"""
    if length_str.endswith("d"):
        return int(length_str[:-1]) * 24 * 60 * 60
    elif length_str.endswith("h"):
        return int(length_str[:-1]) * 60 * 60
    elif length_str.endswith("m"):
        return int(length_str[:-1]) * 60
    else:
        return None

def format_time(seconds):
    """Maak tijd leesbaar"""
    if seconds < 0:
        return "VERLOPEN"
    
    days = int(seconds // (24 * 60 * 60))
    hours = int((seconds % (24 * 60 * 60)) // (60 * 60))
    minutes = int((seconds % (60 * 60)) // 60)
    
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0 or not parts:
        parts.append(f"{minutes}m")
    
    return " ".join(parts)

def generate_key():
    """Genereer een random key"""
    chars = string.ascii_uppercase + string.digits
    key = ''.join(secrets.choice(chars) for _ in range(16))
    return f"{key[:4]}-{key[4:8]}-{key[8:12]}-{key[12:16]}"

# ============================================================
# 🎯 COMMANDS
# ============================================================

@bot.event
async def on_ready():
    print(f"✅ Bot is online: {bot.user}")
    try:
        await bot.tree.sync()
        print("✅ Slash commands gesynchroniseerd!")
    except Exception as e:
        print(f"❌ Fout: {e}")

# ============================================================
# /cs2cheat - KEY GEVEN
# ============================================================

@bot.tree.command(name="cs2cheat", description="Geef een CS2 Cheat key aan een gebruiker")
@app_commands.describe(
    lengte="Hoe lang? (bv: 1d, 3h, 30m)",
    gebruiker="De gebruiker die de key krijgt"
)
async def cs2cheat(interaction: discord.Interaction, lengte: str, gebruiker: discord.Member):
    # 👇 CHECK OF DE GEBRUIKER DE JUISTE ROL HEEFT
    heeft_rol = False
    for role in interaction.user.roles:
        if role.id == ALLOWED_ROLE_ID:
            heeft_rol = True
            break
    
    if not heeft_rol:
        await interaction.response.send_message(
            "❌ Je hebt niet de juiste rol!",
            ephemeral=True
        )
        return
    
    # Parse de lengte
    seconds = parse_length(lengte)
    if seconds is None:
        await interaction.response.send_message(
            "❌ Gebruik: `1d` (dag), `3h` (uur), `30m` (minuut)",
            ephemeral=True
        )
        return
    
    # Max 30 dagen
    if seconds > 30 * 24 * 60 * 60:
        await interaction.response.send_message(
            "❌ Max 30 dagen!",
            ephemeral=True
        )
        return
    
    # Genereer key
    key = generate_key()
    
    # Sla op in database
    data = load_data()
    user_id = str(gebruiker.id)
    
    expiry = datetime.datetime.now() + datetime.timedelta(seconds=seconds)
    expiry_str = expiry.isoformat()
    
    data["users"][user_id] = {
        "key": key,
        "expiry": expiry_str,
        "given_by": str(interaction.user.id),
        "given_at": datetime.datetime.now().isoformat()
    }
    save_data(data)
    
    # Stuur bevestiging
    embed = discord.Embed(
        title="✅ Key Aangemaakt!",
        color=discord.Color.green()
    )
    embed.add_field(name="👤 Gebruiker", value=gebruiker.mention, inline=True)
    embed.add_field(name="🔑 Key", value=f"`{key}`", inline=True)
    embed.add_field(name="⏰ Verloopt", value=f"<t:{int(expiry.timestamp())}:R>", inline=True)
    embed.add_field(name="📅 Duur", value=lengte, inline=True)
    
    await interaction.response.send_message(embed=embed)
    
    # Stuur DM naar gebruiker
    try:
        dm = discord.Embed(
            title="🎯 CS2 Cheat Key",
            description="Je hebt een key ontvangen!",
            color=discord.Color.gold()
        )
        dm.add_field(name="🔑 Key", value=f"`{key}`", inline=False)
        dm.add_field(name="⏰ Verloopt", value=f"<t:{int(expiry.timestamp())}:R>", inline=False)
        await gebruiker.send(embed=dm)
    except:
        pass  # DM's uit

# ============================================================
# /status - CHECK STATUS
# ============================================================

@bot.tree.command(name="status", description="Check status van een gebruiker")
@app_commands.describe(
    gebruiker="De gebruiker om te checken"
)
async def status(interaction: discord.Interaction, gebruiker: discord.Member):
    data = load_data()
    user_id = str(gebruiker.id)
    
    if user_id not in data["users"]:
        await interaction.response.send_message(
            f"❌ {gebruiker.mention} heeft geen key.",
            ephemeral=True
        )
        return
    
    user_data = data["users"][user_id]
    expiry = datetime.datetime.fromisoformat(user_data["expiry"])
    now = datetime.datetime.now()
    
    if now > expiry:
        embed = discord.Embed(
            title=f"⏰ Status voor {gebruiker.display_name}",
            description="❌ **Key is VERLOPEN!**",
            color=discord.Color.red()
        )
        embed.add_field(name="🔑 Key", value=f"`{user_data['key']}`", inline=False)
    else:
        remaining = (expiry - now).total_seconds()
        embed = discord.Embed(
            title=f"📊 Status voor {gebruiker.display_name}",
            description="✅ **Key is actief!**",
            color=discord.Color.green()
        )
        embed.add_field(name="🔑 Key", value=f"`{user_data['key']}`", inline=False)
        embed.add_field(name="⏰ Resterend", value=f"**{format_time(remaining)}**", inline=False)
        embed.add_field(name="📅 Verloopt", value=f"<t:{int(expiry.timestamp())}:F>", inline=False)
    
    await interaction.response.send_message(embed=embed)

# ============================================================
# /keylist - ALLE KEYS (alleen admin)
# ============================================================

@bot.tree.command(name="keylist", description="Bekijk alle keys (admin only)")
async def keylist(interaction: discord.Interaction):
    # Check admin rol
    heeft_rol = False
    for role in interaction.user.roles:
        if role.id == ALLOWED_ROLE_ID:
            heeft_rol = True
            break
    
    if not heeft_rol:
        await interaction.response.send_message(
            "❌ Alleen admins!",
            ephemeral=True
        )
        return
    
    data = load_data()
    now = datetime.datetime.now()
    
    active = []
    expired = []
    
    for user_id, user_data in data["users"].items():
        expiry = datetime.datetime.fromisoformat(user_data["expiry"])
        try:
            user = await bot.fetch_user(int(user_id))
            name = user.display_name if user else f"Unknown ({user_id})"
        except:
            name = f"Unknown ({user_id})"
        
        if now > expiry:
            expired.append(f"❌ {name} - VERLOPEN")
        else:
            remaining = (expiry - now).total_seconds()
            active.append(f"✅ {name} - {format_time(remaining)} left")
    
    lines = []
    if active:
        lines.append("**🟢 Actieve keys:**")
        lines.extend(active)
    if expired:
        lines.append("\n**🔴 Verlopen keys:**")
        lines.extend(expired)
    
    if not lines:
        lines.append("Geen keys gevonden.")
    
    await interaction.response.send_message("\n".join(lines))

# ============================================================
# 🚀 START DE BOT
# ============================================================

if __name__ == "__main__":
    bot.run(TOKEN)
