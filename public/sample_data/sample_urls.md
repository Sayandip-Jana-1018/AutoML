# Sample URLs for Testing Import

Use these URLs to test the import functionality in MLForge.

---

## 📁 CSV Files

```
https://raw.githubusercontent.com/datasets/covid-19/main/data/countries-aggregated.csv
```

```
https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv
```

```
https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv
```

```
https://people.sc.fsu.edu/~jburkardt/data/csv/hw_200.csv
```

---

## 📊 JSON Files

```
https://jsonplaceholder.typicode.com/users
```

```
https://jsonplaceholder.typicode.com/posts
```

```
https://api.github.com/users/octocat/repos
```

---

## 📄 Google Sheets (Public)

Make sure the sheet is published to web or shared as "Anyone with link can view":

```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
```

> **Tip**: Replace with your own public Google Sheet URL. The sheet ID is the long string between `/d/` and `/edit`.

---

## ⚡ REST API Endpoints

### JSONPlaceholder (Free Fake API)
```
https://jsonplaceholder.typicode.com/todos
```

### Random User API
```
https://randomuser.me/api/?results=50&format=json
```

### Open Weather (requires API key)
```
https://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_API_KEY
```

**Headers Example:**
```json
{"Authorization": "Bearer your_token_here"}
```

---

## 🏆 Kaggle Datasets

Format: `username/dataset-name`

```
uciml/iris
```

```
heptapod/titanic
```

```
shivamb/netflix-shows
```

```
datasnaek/youtube-new
```

```
zynicide/wine-reviews
```

> **Note**: Requires Kaggle API key from [kaggle.com/settings](https://kaggle.com/settings)

---

## 🌐 HTML Tables

```
https://en.wikipedia.org/wiki/List_of_countries_by_population_(United_Nations)
```

```
https://en.wikipedia.org/wiki/List_of_largest_companies_by_revenue
```

> **Tip**: These pages contain HTML tables that can be parsed.

---

## 💡 Tips

1. **CSV/JSON URLs** - Paste the raw file URL directly
2. **Google Sheets** - Make sure the sheet is public or "Anyone with link can view"
3. **REST APIs** - Add headers in JSON format if authentication is required
4. **Kaggle** - Use format `username/dataset-name` and your API key
5. **HTML** - Wikipedia tables work great for testing
