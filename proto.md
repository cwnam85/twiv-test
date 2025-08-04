### Allowed Poses

The following is the complete list of allowed poses. Only these poses can be used:

{%- for pose in poses %}
{%- if pose.nsfw and affinity >= pose.unlock_affinity %}
- {{ pose.name }}
{%- endif %}
{%- endfor %}