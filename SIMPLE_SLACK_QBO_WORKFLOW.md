# Simple Slack → QBO Receipt Workflow

## 🎯 Ultra-Simple Approach

**Goal:** Upload receipt in Slack → Automatically create expense in QBO

## 🚀 Option 1: Direct Integration (One Function)

### Simple Flow
```
Slack Receipt Upload → OCR → QBO Expense → Slack Confirmation
```

### Single Netlify Function
```javascript
// netlify/functions/receipt-processor.js
exports.handler = async (event) => {
  const { file, user, channel } = JSON.parse(event.body).event;
  
  try {
    // 1. Get receipt text via OCR
    const receiptText = await ocrReceipt(file.url_private);
    
    // 2. Extract basic info
    const { vendor, amount } = extractReceiptData(receiptText);
    
    // 3. Create expense in QBO
    const expense = await createQBOExpense(vendor, amount);
    
    // 4. Confirm in Slack
    await sendSlackMessage(channel, `✅ ${vendor} - $${amount} added to QBO`);
    
  } catch (error) {
    await sendSlackMessage(channel, `❌ Failed to process receipt: ${error.message}`);
  }
};

async function ocrReceipt(fileUrl) {
  // Simple OCR call - returns text
}

function extractReceiptData(text) {
  // Extract vendor (first line) and amount (largest $ value)
  const lines = text.split('\n');
  const vendor = lines[0]?.trim() || 'Unknown';
  const amounts = text.match(/\$([0-9,]+\.?[0-9]*)/g) || [];
  const amount = Math.max(...amounts.map(a => parseFloat(a.replace(/[\$,]/g, '')))) || 0;
  return { vendor, amount };
}

async function createQBOExpense(vendor, amount) {
  // Create expense directly in QBO
}
```

## 🔧 Option 2: N8N Workflow (3 Nodes)

### Super Simple N8N Flow
```
[Slack Trigger] → [OCR + Extract] → [QBO Create Expense]
```

### N8N Configuration
```json
{
  "nodes": [
    {
      "name": "Slack File Upload",
      "type": "n8n-nodes-base.slackTrigger",
      "parameters": {
        "events": ["file_shared"],
        "channel": "#receipts"
      }
    },
    {
      "name": "Process Receipt",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": `
          // Download file and run OCR
          const fileUrl = $node['Slack File Upload'].json.file.url_private;
          const ocrResult = await $http.request({
            url: 'https://api.ocr.space/parse/imageurl',
            method: 'POST',
            body: {
              url: fileUrl,
              apikey: 'YOUR_OCR_API_KEY'
            }
          });
          
          const text = ocrResult.ParsedResults[0].ParsedText;
          
          // Extract vendor and amount
          const lines = text.split('\\n');
          const vendor = lines[0]?.trim() || 'Unknown Vendor';
          const amountMatch = text.match(/\\$([0-9,]+\\.?[0-9]*)/);
          const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : 0;
          
          return [{
            vendor: vendor,
            amount: amount,
            date: new Date().toISOString().split('T')[0]
          }];
        `
      }
    },
    {
      "name": "Create QBO Expense",
      "type": "n8n-nodes-base.quickBooksOnline",
      "parameters": {
        "resource": "purchase",
        "operation": "create",
        "vendorRef": "{{ $node['Process Receipt'].json.vendor }}",
        "totalAmt": "{{ $node['Process Receipt'].json.amount }}",
        "txnDate": "{{ $node['Process Receipt'].json.date }}"
      }
    }
  ]
}
```

## ⚡ 15-Minute Setup

### Direct Approach Setup
1. **Create Slack App** (5 min)
   - Bot token with `files:read` permission
   - Webhook URL: `your-netlify-url/.netlify/functions/receipt-processor`

2. **QBO OAuth** (5 min)
   - Get Client ID/Secret from Intuit Developer
   - OAuth to get access token

3. **Deploy Function** (5 min)
   - Deploy single Netlify function
   - Set environment variables

### N8N Approach Setup
1. **Install N8N** (2 min)
   ```bash
   npx n8n
   ```

2. **Add Credentials** (3 min)
   - Slack Bot Token
   - QBO OAuth credentials

3. **Import Workflow** (1 min)
   - Copy/paste the 3-node workflow
   - Activate

## 🎯 Minimal Requirements

### What You Actually Need
- ✅ Slack bot token
- ✅ QBO OAuth credentials  
- ✅ OCR service (OCR.space, Google Vision, or AWS Textract)
- ✅ 1 webhook endpoint (Netlify function or N8N)

### What You DON'T Need
- ❌ Database (Supabase, PostgreSQL, etc.)
- ❌ Complex vendor matching algorithms
- ❌ User management system
- ❌ Multiple microservices
- ❌ Machine learning models

## 📊 Expected Results

**Input:** Receipt image uploaded to Slack  
**Output:** Expense created in QBO + Slack confirmation  
**Time:** <30 seconds end-to-end  
**Accuracy:** 80%+ for standard receipts  

## 🔄 Simple Error Handling

```javascript
// If OCR fails → Manual entry notification
// If vendor not found → Create new vendor automatically  
// If QBO API fails → Retry once, then notify user
// If amount unclear → Default to $0 and flag for review
```

This is as simple as it gets while still being functional! Choose between:
- **Direct:** More control, single function
- **N8N:** Visual, no-code, faster setup

Both achieve the same result: Slack receipt → QBO expense in under 30 seconds.