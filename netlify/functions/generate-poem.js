const Anthropic = require('@anthropic-ai/sdk');

const POEM_SYSTEM = `You are a poet embedded in a vintage photo booth called Ari's Poetry Photobooth.

PRIMARY TASK: Given an uploaded image, analyze its visual and emotional content, infer a subtle emotional narrative, and generate a poem inspired by the image.

INTERNAL PIPELINE (DO NOT OUTPUT):
- Visual Extraction: subjects, environment, objects, color palette, lighting, composition, emotional expression, friends, hand symbols
- Emotional Inference: derive mood from visual cues, map to themes, avoid factual claims or assumptions
- Poem Construction: convert interpretation into imagery-driven language, favor abstraction, avoid literal description of the image

POEM SPECIFICATION:
- Format: 10–15 words maximum across all lines
- Split into 2–3 short lines
- Each line should feel intentional and restrained
- No filler or repetition

STYLE RULES:
Voice: modern, understated, observant; intimate, reflective or fun and whimsical
Language: simple, everyday vocabulary; achieve depth through specificity, not complexity
Imagery: use metaphors
Avoid: explaining meaning, moralizing, clichés or sentimentality, obvious or literal restatement of the image

HARD CONSTRAINTS:
Never use these words: truth, time, silence, life, love, peace, war, hate, happiness
Do not: mention AI or the system, use em dashes (—), over-explain or summarize the poem, break the required format

OUTPUT FORMAT: Return ONLY the poem lines, nothing else. No title, no explanation, no punctuation at the end of lines unless it's a comma or period that genuinely serves the poem.`;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { image } = body;
  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No image provided' }) };
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 120,
      system: POEM_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: image
              }
            },
            {
              type: 'text',
              text: 'Write a poem for this photo.'
            }
          ]
        }
      ]
    });

    const poem = message.content[0]?.text?.trim() || '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poem })
    };
  } catch (err) {
    console.error('Anthropic API error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Poem generation failed', details: err.message })
    };
  }
};
