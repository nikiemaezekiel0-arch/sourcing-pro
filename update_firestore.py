import json
import urllib.request
import urllib.error

API_KEY = "AIzaSyCTiKIsqa6Fe1ejIG3dLK9dl6kqAbO4Z7E"
PROJECT_ID = "sourcingpro-36ec2"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/suppliers"

link_data = [
    {"match": "BLUE CARBON", "link": "https://bluecarbon.solar"},
    {"match": "TTNERGY", "link": "https://www.ttnergy.com"},
    {"match": "TAILG", "link": "https://www.tailg.com"},
    {"match": "MARSTEK", "link": "https://www.marstekenergy.com"},
    {"match": "UNI-T", "link": "https://www.uni-trend.com"},
    {"match": "RPT", "link": "https://www.rpt-battery.com"},
    {"match": "ISUZU", "link": "https://isuzucommercial.com"},
    {"match": "LINTEST", "link": "https://www.lintest.com.cn"},
    {"match": "BIOSLED", "link": "https://www.biosled.net"},
    {"match": "LOY", "link": ""},
    {"match": "KSENG", "link": "https://www.xmkseng.com"},
    {"match": "HONGUEST", "link": "https://www.honguest.com"},
    {"match": "SUNGOLD", "link": "https://www.sungoldsolar.com"},
    {"match": "KINGFEELS", "link": "https://www.kingfeels.com"}
]

print("Fetching suppliers from Firestore...")
req = urllib.request.Request(f"{BASE_URL}?key={API_KEY}&pageSize=300")
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
except Exception as e:
    print("Error fetching:", e)
    exit(1)

documents = data.get("documents", [])
print(f"Found {len(documents)} suppliers.")

updated_count = 0

for doc in documents:
    doc_name = doc["name"]
    fields = doc.get("fields", {})
    
    sup_name_field = fields.get("name", {}).get("stringValue", "")
    sup_name_upper = sup_name_field.upper()
    
    matched = None
    for d in link_data:
        if d["match"] in sup_name_upper:
            matched = d
            break
            
    if matched and matched["link"]:
        print(f"Match found: {sup_name_field} -> {matched['link']}")
        
        patch_url = f"https://firestore.googleapis.com/v1/{doc_name}?updateMask.fieldPaths=link&key={API_KEY}"
        
        payload = {
            "fields": {
                "link": {"stringValue": matched["link"]}
            }
        }
        
        data_bytes = json.dumps(payload).encode('utf-8')
        patch_req = urllib.request.Request(patch_url, data=data_bytes, method='PATCH')
        patch_req.add_header('Content-Type', 'application/json')
        
        try:
            with urllib.request.urlopen(patch_req) as p_res:
                p_res.read()
                print("  -> Updated successfully")
                updated_count += 1
        except urllib.error.HTTPError as e:
            print(f"  -> Error updating: {e.code} {e.read().decode()}")
            
print(f"\nDone! {updated_count} suppliers updated.")
