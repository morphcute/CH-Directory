import sharp from "sharp";

async function run() {
  const input =
    "C:/Users/evang/.gemini/antigravity-ide/brain/840b0875-83df-40b1-9bb3-e9827442b67a/.user_uploaded/media_1788731442747.png";
  
  // Extract banner: top section
  await sharp(input)
    .extract({ left: 0, top: 0, width: 428, height: 165 })
    .png()
    .toFile("public/images/mlbb-ch-banner.png");

  // Extract avatar with round mask
  const size = 176;
  const left = 214 - 88;
  const top = 177 - 88;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/></svg>`
  );

  await sharp(input)
    .extract({ left, top, width: size, height: size })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile("public/images/mlbb-ch-avatar.png");

  console.log("Assets extracted successfully!");
}

run().catch(console.error);
