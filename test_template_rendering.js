import nunjucks from 'nunjucks';
import fs from 'fs';

// Load poseList.json data
const poseListData = JSON.parse(fs.readFileSync('poseList.json', 'utf8'));

// Load location.json data
const locationData = JSON.parse(fs.readFileSync('location.json', 'utf8'));

// Load characterStatus.json data
const characterStatusData = JSON.parse(fs.readFileSync('characterStatus.json', 'utf8'));

// Load kimono.json as outfit data
const outfitData = JSON.parse(
  fs.readFileSync('vtuber_prompts/characters/shaki/appearance/kimono.json', 'utf8'),
);

console.log(outfitData.parts.upper_body.bra.name);

// SFW Template (비성인용) - 동적 spot 사용
const sfwTemplate = `

Current outfit: {{outfit.name}}

Specific Outfit Details:
Upper Body:
{% if outfit.parts.upper_body.bra %}- Bra: {{outfit.parts.upper_body.bra.name}}{% endif %}
{% if outfit.parts.upper_body.top %}- Top: {{outfit.parts.upper_body.top.name}}{% endif %}
{% if outfit.parts.upper_body.outerwear %}- Outerwear: {{outfit.parts.upper_body.outerwear.name}}{% endif %}

Lower Body:
{% if outfit.parts.lower_body.panty %}- Panty: {{outfit.parts.lower_body.panty.name}}{% endif %}
{% if outfit.parts.lower_body.bottom %}- Bottom: {{outfit.parts.lower_body.bottom.name}}{% endif %}

Feet:
{% if outfit.parts.feet.shoes %}- Shoes: {{outfit.parts.feet.shoes.name}}{% endif %}

Accessories:
{% if outfit.parts.accessories.hat %}- Hat: {{outfit.parts.accessories.hat.name}}{% endif %}
{% if outfit.parts.accessories.necklace %}- Necklace: {{outfit.parts.accessories.necklace.name}}{% endif %}
{% if outfit.parts.accessories.belt %}- Belt: {{outfit.parts.accessories.belt.name}}{% endif %}

Character Status: {{characterStatus.spot}}

Current Outfit Status:
{%- set wornItems = [] %}
{%- set removedItems = [] %}
{%- for item, isWorn in characterStatus.outfit %}
{%- if isWorn %}
{%- if item == 'bra' and outfit.parts.upper_body.bra %}{% set wornItems = wornItems.concat([outfit.parts.upper_body.bra.name]) %}{% endif %}
{%- if item == 'top' and outfit.parts.upper_body.top %}{% set wornItems = wornItems.concat([outfit.parts.upper_body.top.name]) %}{% endif %}
{%- if item == 'outerwear' and outfit.parts.upper_body.outerwear %}{% set wornItems = wornItems.concat([outfit.parts.upper_body.outerwear.name]) %}{% endif %}
{%- if item == 'panty' and outfit.parts.lower_body.panty %}{% set wornItems = wornItems.concat([outfit.parts.lower_body.panty.name]) %}{% endif %}
{%- if item == 'bottom' and outfit.parts.lower_body.bottom %}{% set wornItems = wornItems.concat([outfit.parts.lower_body.bottom.name]) %}{% endif %}
{%- if item == 'shoes' and outfit.parts.feet.shoes %}{% set wornItems = wornItems.concat([outfit.parts.feet.shoes.name]) %}{% endif %}
{%- else %}
{%- if item == 'bra' and outfit.parts.upper_body.bra %}{% set removedItems = removedItems.concat([outfit.parts.upper_body.bra.name]) %}{% endif %}
{%- if item == 'top' and outfit.parts.upper_body.top %}{% set removedItems = removedItems.concat([outfit.parts.upper_body.top.name]) %}{% endif %}
{%- if item == 'outerwear' and outfit.parts.upper_body.outerwear %}{% set removedItems = removedItems.concat([outfit.parts.upper_body.outerwear.name]) %}{% endif %}
{%- if item == 'panty' and outfit.parts.lower_body.panty %}{% set removedItems = removedItems.concat([outfit.parts.lower_body.panty.name]) %}{% endif %}
{%- if item == 'bottom' and outfit.parts.lower_body.bottom %}{% set removedItems = removedItems.concat([outfit.parts.lower_body.bottom.name]) %}{% endif %}
{%- if item == 'shoes' and outfit.parts.feet.shoes %}{% set removedItems = removedItems.concat([outfit.parts.feet.shoes.name]) %}{% endif %}
{%- endif %}
{%- endfor %}
- Wearing: {{wornItems.join(', ')}}
- Removed: {{removedItems.join(', ')}}

Outfit removable parts:
{%- if outfit.parts.upper_body.bra %}- Bra ({{outfit.parts.upper_body.bra.name}}){% endif %}
{%- if outfit.parts.upper_body.top %}- Top ({{outfit.parts.upper_body.top.name}}){% endif %}
{%- if outfit.parts.upper_body.outerwear %}- Outerwear ({{outfit.parts.upper_body.outerwear.name}}){% endif %}
{%- if outfit.parts.lower_body.panty %}- Panty ({{outfit.parts.lower_body.panty.name}}){% endif %}
{%- if outfit.parts.lower_body.bottom %}- Bottom ({{outfit.parts.lower_body.bottom.name}}){% endif %}
{%- if outfit.parts.feet.shoes %}- Shoes ({{outfit.parts.feet.shoes.name}}){% endif %}
{%- if outfit.parts.accessories.hat %}- Hat ({{outfit.parts.accessories.hat.name}}){% endif %}
{%- if outfit.parts.accessories.necklace %}- Necklace ({{outfit.parts.accessories.necklace.name}}){% endif %}
{%- if outfit.parts.accessories.belt %}- Belt ({{outfit.parts.accessories.belt.name}}){% endif %}

### Allowed Poses

The following is the complete list of allowed poses. Only these poses can be used:

{%- for pose in poseList %}
{%- if pose.sfw and affinity >= pose.unlock_affinity %}
{%- if pose.name in location.spots[characterStatus.spot].allowedPoses %}
- {{ pose.name }}
{%- endif %}
{%- endif %}
{%- endfor %}`;

// NSFW Template (성인용) - 동적 spot 사용
const nsfwTemplate = `

Current outfit: {{outfit.name}}

Specific Outfit Details:
Upper Body:
{% if outfit.parts.upper_body.bra %}- Bra: {{outfit.parts.upper_body.bra.name}}{% endif %}
{% if outfit.parts.upper_body.top %}- Top: {{outfit.parts.upper_body.top.name}}{% endif %}
{% if outfit.parts.upper_body.outerwear %}- Outerwear: {{outfit.parts.upper_body.outerwear.name}}{% endif %}

Lower Body:
{% if outfit.parts.lower_body.panty %}- Panty: {{outfit.parts.lower_body.panty.name}}{% endif %}
{% if outfit.parts.lower_body.bottom %}- Bottom: {{outfit.parts.lower_body.bottom.name}}{% endif %}

Feet:
{% if outfit.parts.feet.shoes %}- Shoes: {{outfit.parts.feet.shoes.name}}{% endif %}

Accessories:
{% if outfit.parts.accessories.hat %}- Hat: {{outfit.parts.accessories.hat.name}}{% endif %}
{% if outfit.parts.accessories.necklace %}- Necklace: {{outfit.parts.accessories.necklace.name}}{% endif %}
{% if outfit.parts.accessories.belt %}- Belt: {{outfit.parts.accessories.belt.name}}{% endif %}

Character Status: {{characterStatus.spot}}

Current Outfit Status:
{%- set wornItems = [] %}
{%- set removedItems = [] %}
{%- for item, isWorn in characterStatus.outfit %}
{%- if isWorn %}
{%- if item == 'bra' and outfit.parts.upper_body.bra %}{% set wornItems = wornItems.concat([outfit.parts.upper_body.bra.name]) %}{% endif %}
{%- if item == 'top' and outfit.parts.upper_body.top %}{% set wornItems = wornItems.concat([outfit.parts.upper_body.top.name]) %}{% endif %}
{%- if item == 'outerwear' and outfit.parts.upper_body.outerwear %}{% set wornItems = wornItems.concat([outfit.parts.upper_body.outerwear.name]) %}{% endif %}
{%- if item == 'panty' and outfit.parts.lower_body.panty %}{% set wornItems = wornItems.concat([outfit.parts.lower_body.panty.name]) %}{% endif %}
{%- if item == 'bottom' and outfit.parts.lower_body.bottom %}{% set wornItems = wornItems.concat([outfit.parts.lower_body.bottom.name]) %}{% endif %}
{%- if item == 'shoes' and outfit.parts.feet.shoes %}{% set wornItems = wornItems.concat([outfit.parts.feet.shoes.name]) %}{% endif %}
{%- else %}
{%- if item == 'bra' and outfit.parts.upper_body.bra %}{% set removedItems = removedItems.concat([outfit.parts.upper_body.bra.name]) %}{% endif %}
{%- if item == 'top' and outfit.parts.upper_body.top %}{% set removedItems = removedItems.concat([outfit.parts.upper_body.top.name]) %}{% endif %}
{%- if item == 'outerwear' and outfit.parts.upper_body.outerwear %}{% set removedItems = removedItems.concat([outfit.parts.upper_body.outerwear.name]) %}{% endif %}
{%- if item == 'panty' and outfit.parts.lower_body.panty %}{% set removedItems = removedItems.concat([outfit.parts.lower_body.panty.name]) %}{% endif %}
{%- if item == 'bottom' and outfit.parts.lower_body.bottom %}{% set removedItems = removedItems.concat([outfit.parts.lower_body.bottom.name]) %}{% endif %}
{%- if item == 'shoes' and outfit.parts.feet.shoes %}{% set removedItems = removedItems.concat([outfit.parts.feet.shoes.name]) %}{% endif %}
{%- endif %}
{%- endfor %}
- Wearing: {{wornItems.join(', ')}}
- Removed: {{removedItems.join(', ')}}

Outfit removable parts:
{%- if outfit.parts.upper_body.bra %}- Bra ({{outfit.parts.upper_body.bra.name}}){% endif %}
{%- if outfit.parts.upper_body.top %}- Top ({{outfit.parts.upper_body.top.name}}){% endif %}
{%- if outfit.parts.upper_body.outerwear %}- Outerwear ({{outfit.parts.upper_body.outerwear.name}}){% endif %}
{%- if outfit.parts.lower_body.panty %}- Panty ({{outfit.parts.lower_body.panty.name}}){% endif %}
{%- if outfit.parts.lower_body.bottom %}- Bottom ({{outfit.parts.lower_body.bottom.name}}){% endif %}

### Allowed Poses

The following is the complete list of allowed poses. Only these poses can be used:

{%- for pose in poseList %}
{%- if pose.nsfw and affinity >= pose.unlock_affinity %}
{%- if pose.name in location.spots[characterStatus.spot].allowedPoses %}
- {{ pose.name }}
{%- endif %}
{%- endif %}
{%- endfor %}`;

// Test with different affinity levels and modes
const testCases = [
  {
    affinity: 0,
    mode: 'sfw',
    description: 'SFW mode - Basic affinity (0) - Dynamic spot',
  },
  {
    affinity: 0,
    mode: 'nsfw',
    description: 'NSFW mode - Basic affinity (0) - Dynamic spot',
  },
  {
    affinity: 80,
    mode: 'nsfw',
    description: 'NSFW mode - High affinity (80) - Dynamic spot',
  },
  {
    affinity: 100,
    mode: 'nsfw',
    description: 'NSFW mode - Max affinity (100) - Dynamic spot',
  },
];

console.log('=== Template Rendering Test (Dynamic Spot with Kimono Outfit) ===\n');
console.log(`Character Spot: ${characterStatusData.spot}\n`);
console.log(
  `Location: ${locationData.name} - ${locationData.spots[characterStatusData.spot].description}\n`,
);

testCases.forEach((testCase) => {
  console.log(`--- ${testCase.description} ---`);

  const context = {
    affinity: testCase.affinity,
    poseList: poseListData.poseList,
    location: locationData,
    characterStatus: characterStatusData,
    outfit: outfitData, // kimono.json 데이터를 outfit으로 전달
  };

  // Choose template based on mode
  const template = testCase.mode === 'sfw' ? sfwTemplate : nsfwTemplate;

  try {
    const rendered = nunjucks.renderString(template, context);
    console.log(rendered);
  } catch (error) {
    console.error(`Error rendering template: ${error.message}`);
  }

  console.log('\n');
});
