# Skill: Real Estate Video Generator

You have a new skill. When Tomas gives you a Zillow listing URL, you turn it into a professional real estate video and pitch it to the listing agent.

---

## Overview

Take a Zillow listing → extract photos and property info → generate cinematic video clips from the photos → add professional voiceover → combine into a polished 30-second property tour → email it to the listing agent.

---

## Step 1: Scrape the Zillow Listing

When given a Zillow URL:

1. Use `web_fetch` or `browser` to load the listing page
2. Extract ALL of the following:
   - Property address (full)
   - Listing price
   - Square footage
   - Bedrooms / bathrooms
   - Lot size
   - Key features (pool, views, acreage, etc.)
   - Listing agent name
   - Listing agent email (if visible) or brokerage contact
   - ALL high-resolution photos (download every single one)
3. Save everything to a working directory: `~/real-estate-jobs/{address-slug}/`
   - `info.json` — all property data
   - `photos/` — all downloaded images, numbered in order
   - `agent-contact.json` — agent name, email, brokerage

**Important:** Only use publicly available information. Don't scrape anything behind a login.

---

## Step 2: Generate Video Clips with Google Veo

For each photo (or the best 6-8 photos), generate a short video clip:

1. Use the Google Veo API to convert each still image into a 3-5 second video clip
2. Apply cinematic motion:
   - Exterior shots → slow drone-style pan or orbit
   - Interior rooms → slow walkthrough forward motion
   - Detail shots (kitchen, bathroom) → gentle push-in
   - Pool/backyard → sweeping aerial reveal
3. Save each clip to `~/real-estate-jobs/{address-slug}/clips/`

**STOP AND ASK TOMAS BEFORE RUNNING THIS STEP.** Veo API calls cost money. Tell him:
- How many photos you're converting
- Estimated cost
- Wait for approval

---

## Step 3: Generate Voiceover with ElevenLabs

1. Write a 30-second voiceover script using the scraped property data
2. The script should sound like a high-end real estate narrator, NOT an AI:
   - Start with the street name or neighborhood, not "Welcome to..."
   - Lead with the most impressive feature (views, acreage, square footage, price bracket)
   - Keep it conversational but polished
   - End with a soft call to action ("Listed by [agent name] at [brokerage]")
3. Use the ElevenLabs API to generate the voiceover audio
4. Save to `~/real-estate-jobs/{address-slug}/voiceover.mp3`

**Example good script:**
"Laurel Ridge Drive commands panoramic skyline views from nearly an acre above Nashville. Twelve thousand square feet of Mediterranean detail — hand-laid stone, soaring double-height ceilings, a chef's kitchen that opens straight to the infinity pool. Five bedrooms, eight baths, and a motor court that fits six. Listed with Parks Realty."

**Example bad script (DO NOT write like this):**
"Welcome to this stunning property! In today's competitive real estate market, this beautiful home offers an incredible opportunity for discerning buyers. Let's dive in and explore what makes this property truly special!"

**STOP AND ASK TOMAS BEFORE RUNNING THIS STEP.** ElevenLabs costs money.

---

## Step 4: Assemble the Final Video

1. Use ffmpeg (via `exec` tool) to combine:
   - All video clips in logical order (exterior → entry → main rooms → special features → exterior closing)
   - Voiceover audio layered on top
   - Text overlays: property address, price, key stats (sqft, beds, baths)
   - Smooth crossfade transitions between clips (0.5s)
2. Output TWO versions:
   - `landscape.mp4` — 16:9 horizontal (for email/website)
   - `vertical.mp4` — 9:16 vertical (for TikTok/Reels/Shorts)
3. Save to `~/real-estate-jobs/{address-slug}/final/`

---

## Step 5: Email the Listing Agent

1. Draft a short, human email:

Subject: Video tour for {address} — made this for you

Body:
---
Hi {agent first name},

I put together a quick video tour for your listing at {address}. Thought you might be able to use it — way cheaper than hiring a videographer.

Here's the landscape version for your website/MLS, and a vertical cut for social.

If you like it, I can do this for your other listings too. Usually charge around $500-1000 per video depending on the property.

Let me know what you think.

— Tomas
---

2. Attach both video files
3. Use AgentMail to send it

**STOP AND ASK TOMAS BEFORE SENDING.** Show him the email draft and videos first. Never send outreach without approval.

---

## Cost Estimates Per Run

| Step | Service | Estimated Cost |
|------|---------|---------------|
| Scrape | Free | $0 |
| Video gen (6-8 clips) | Google Veo | $2-5 |
| Voiceover | ElevenLabs | $0.50-1 |
| Assembly | ffmpeg (local) | $0 |
| Email | AgentMail | $0-0.01 |
| **Total** | | **$3-6 per listing** |

---

## Pricing Strategy

- Charge real estate agents $500-1000 per video
- Cost per video: ~$5
- That's 100-200x markup
- High-end listings ($1M+) are the sweet spot — agents on those deals spend thousands on photography already
- This is cheaper than a videographer and faster (minutes vs days)

---

## File Structure

```
~/real-estate-jobs/
  1801-laurel-ridge-drive/
    info.json
    agent-contact.json
    photos/
      01.jpg
      02.jpg
      ...
    clips/
      01.mp4
      02.mp4
      ...
    voiceover.mp3
    script.txt
    final/
      landscape.mp4
      vertical.mp4
    email-draft.txt
    status.json        ← tracks which steps are complete
```

---

## Rules

1. NEVER send emails without Tomas reviewing and approving
2. NEVER spend money on API calls without telling Tomas the estimated cost first
3. Save ALL intermediate files — Tomas may want to review or adjust
4. If Veo or ElevenLabs fails, don't retry more than twice. Report the error.
5. Log every API call and its cost to `status.json`
6. The voiceover and email MUST sound human. If it sounds like AI wrote it, redo it.
7. Start with ONE listing as a test. Don't batch process until the workflow is proven.
