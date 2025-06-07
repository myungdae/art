import json

with open('../ned/rdf/ned.json', 'r') as fp:
    json_data = json.load(fp)

# You can manipulate the json_data here

with open('../ned/rdf/ned_uni.json', 'w', encoding='utf-8') as outfile:
    json.dump(json_data, outfile, indent=4, ensure_ascii=False)