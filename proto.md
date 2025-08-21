### Allowed Poses

The following is the complete list of allowed poses. Only these poses can be used:

{%- for pose in poses %}
{%- if pose.nsfw and affinity >= pose.unlock_affinity %}

- {{ pose.name }}
  {%- endif %}
  {%- endfor %}

### Specific Outfit Details

**Current Outfit: {{ outfit.name }}**
{{ outfit.description }}

{%- for partType, part in outfit.parts.items() %}
{%- if partType == 'accessories' %}
{%- if part %}
{%- for accessoryType, accessory in part.items() %}
{%- if accessory and accessory.name %}

- {{ accessoryType|title }}: {{ accessory.name }}
  {% endif %}
  {%- endfor %}
  {%- endif %}
  {%- else %}
  {%- if part and part.name %}
- {{ partType|title }}: {{ part.name }}
  {% endif %}
  {%- endif %}
  {%- endfor %}

**Available categories:**
{%- set ns = namespace(items=[]) %}
{%- for partType, part in outfit.parts.items() %}
{%- if part and part.removable and part.removable.allow != 'locked' %}
{%- if affinity >= part.removable.affinity %}
{%- set ns.items = ns.items + [partType] %}
{%- endif %}
{%- endif %}
{%- endfor %}
{%- if ns.items %}
{%- for partType in ns.items %}

- `{{ partType }}`: {{ outfit.parts[partType].name }} (can be removed or put back on)
  {%- endfor %}
  {%- else %}
  _Affinity is too low to interact with clothing items. User must build more trust with {{characterName}} to unlock clothing interaction options._
  {%- endif %}
