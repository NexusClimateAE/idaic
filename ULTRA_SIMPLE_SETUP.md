# Ultra-Simple Slack → QBO Setup

## 🎯 Two Dead-Simple Options

### Option 1: Direct (Single Function)
```javascript
// One function does everything
exports.handler = async (event) => {
  const { file } = JSON.parse(event.body).event;
  
  // OCR the receipt
  const text = await getTextFromImage(file.url_private);
  
  // Extract vendor and amount (basic regex)
  const vendor = text.split('\n')[0]?.trim() || 'Unknown';
  const amount = parseFloat(text.match(/\$([0-9,]+\.?[0-9]*)/)?.[1]?.replace(',', '') || '0');
  
  // Create QBO expense
  await createQBOExpense({ vendor, amount });
  
  return { statusCode: 200 };
};
```

### Option 2: N8N (4 Nodes)
```
Slack → Extract Data → Create QBO Expense → Confirm
```

## ⚡ 10-Minute Setup

### Direct Setup
1. **Slack Webhook** → Point to your Netlify function
2. **Add OCR** → Use OCR.space free API  
3. **QBO Connection** → OAuth once, store tokens
4. **Deploy** → Single function handles everything

### N8N Setup  
1. **Install N8N** → `npx n8n`
2. **Import Workflow** → Use `MINIMAL_N8N_WORKFLOW.json`
3. **Add Credentials** → Slack + QBO tokens
4. **Activate** → Done!

## 🔧 What You Need

### Credentials Required
- Slack Bot Token (1 permission: `files:read`)
- QBO OAuth tokens (1 scope: accounting access)
- OCR API key (free tier available)

### Infrastructure
- **Direct:** 1 Netlify function
- **N8N:** 1 workflow with 4 nodes

## 📱 User Experience

### Slack Side
1. Upload receipt to `#receipts` channel
2. Get confirmation: "✅ Starbucks - $4.50 added to QBO"

### QBO Side  
1. New expense appears automatically
2. Vendor created if doesn't exist
3. Receipt attached (if supported)

## 🎯 Success Definition

**Input:** Receipt image in Slack  
**Output:** Expense in QBO  
**Time:** <30 seconds  
**Setup:** <10 minutes  

That's it! No databases, no complex matching, no multi-week projects. Just upload → process → done.