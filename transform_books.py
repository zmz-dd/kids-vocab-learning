import json
import os

input_file = "/home/user/workspace/upload/builtin_books.json"
output_file = "/home/user/workspace/website/kids-vocab-learning/src/assets/builtin_books.json"

def transform_books():
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Group by level
        books_map = {}
        for item in data:
            level = item.get("level", "Uncategorized")
            if level not in books_map:
                books_map[level] = []
            
            # Ensure required fields
            word_entry = {
                "word": item.get("word", ""),
                "pos": item.get("pos", ""),
                "meaning": item.get("meaning", ""),
                "phonetic": item.get("phonetic", ""),
                "audio": item.get("audio", ""),
                "example": item.get("example", ""),
                "exampleAudio": item.get("exampleAudio", ""),
                "level": level,
                "initial": item.get("initial", item.get("word", "A")[0].upper())
            }
            books_map[level].append(word_entry)
            
        # Create output structure
        output_data = []
        # Mapping for IDs
        id_map = {
            "KET一级": "ket_level_1",
            "KET二级": "ket_level_2",
            "KET三级": "ket_level_3"
        }
        
        for level, words in books_map.items():
            book_id = id_map.get(level, level.lower().replace(" ", "_"))
            output_data.append({
                "id": book_id,
                "title": level,
                "words": words
            })
            
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully transformed {len(data)} words into {len(output_data)} books.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    transform_books()
