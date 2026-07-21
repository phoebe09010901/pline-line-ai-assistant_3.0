# Memo Create Deterministic Contract

## Gate identity

```text
PROJECT: 菲比 LINE 智能助理_03
CATEGORY: PLine｜DOC｜文件與規格整理
GATE: Memo Create Deterministic Contract Lock
STATUS: CONTRACT_LOCKED
IMPLEMENTATION_READY: yes
FAILED_LAYER: none
LOOP_DETECTED: no
```

本文件只鎖定 Memo 新增契約。它不是實作證明、部署證明或 live acceptance，也不授權 Memo Search／Modify／Delete、Calendar、`codex_delegate`、`crud_task:v1`、n8n／Worker／Monitor 修改或任何外部操作。

## 1. Formal command contract

唯一對外正式新增指令：

```text
備忘錄：<內容>
```

正式範例：

```text
備忘錄：星期五記得確認報價單
```

此例的 `canonical_content` 為 `星期五記得確認報價單`。

鎖定規則：

- 對輸入整體做首尾空白清理後，只接受精確前綴 `備忘錄：`（全形冒號）。
- `記一下：` 不再是 Memo 對外正式指令。
- 不以 AI、Codex Agent、n8n intent classifier、廣義語意、同義詞或正規表示式猜測 CRUD。
- prefix 命中後直接走專用 Memo Create deterministic route；不得恢復通用 CRUD、Calendar、`codex_delegate` 或 `crud_task:v1`。

### Legacy compatibility report

現有架構仍有 `記一下：` 的 `idea_create` 舊路徑。此 Gate 不刪除、不修改、也不把它升格為 Memo 指令；若保留，只能作為隱藏的既有 idea compatibility。Memo Create 不接受 `記一下：`，是否日後移除該 legacy path 不在本 Gate。

## 2. Canonical content and rejection

`canonical_content` 定義為：精確移除第一個 `備忘錄：` 前綴後，對其後全部文字做 `trim`；內容內其他冒號與文字原樣保留。

```text
canonical_content = trim(input_after_exact_prefix)
```

- `canonical_content` 必須為非空文字。
- 空字串或只有空白：立即拒絕，不建立 task、不建立 pending key、不建立 JSON。
- 空內容拒絕回覆必須是固定、真實且不宣稱成功的 Reply API 訊息，例如：`請在「備忘錄：」後面輸入要記錄的內容。`

## 3. Canonical storage paths

```text
MEMO_ACTIVE_PATH=/Users/phoebe/Library/CloudStorage/Dropbox/菲比工作總倉庫/00_INBOX_臨時丟進來
MEMO_ARCHIVE_PATH=/Users/phoebe/Library/CloudStorage/Dropbox/菲比工作總倉庫/99_ARCHIVE_封存
```

- Memo Create 只可寫入 `MEMO_ACTIVE_PATH`。
- `MEMO_ARCHIVE_PATH` 只保留給未來經授權的封存流程；本 Gate 不寫入。
- `01_OUTBOX_完成檔案` 已失效，不得再當作 Memo 正式位置。
- 不接受使用者指定路徑、檔名或跨目錄寫入。

## 4. JSON contract

每個新 Memo JSON 必須且只需包含以下最小業務欄位：

```json
{
  "schema": "pline-memo/v1",
  "memo_id": "memo-<privacy-preserving-event-fingerprint>",
  "type": "memo",
  "content": "<canonical_content>",
  "status": "active",
  "created_at": "<RFC3339 timestamp>",
  "updated_at": "<same RFC3339 timestamp at creation>",
  "source": "line"
}
```

鎖定規則：

- `source` 只記錄來源類型 `line`，不得放帳號、姓名或識別資訊。
- JSON 不得包含 raw User ID、replyToken、secret、原始 webhook payload 或可重放憑證。
- `memo_id` 必須由同一 LINE event 的隱私保護 deterministic fingerprint 產生；不得把 raw event id 寫入 JSON。
- 檔名固定為 `<memo_id>.json`，不得使用訊息內容當檔名。
- 不得覆蓋既有檔案。相同 event 再送時必須解析到同一 `memo_id`／檔名並回傳既有結果；不同 event 必須得到不同 `memo_id`。

## 5. Idempotency and exactly-once lock

### Event acceptance

- 保留現有 bounded durable ACK 與 event idempotency gate。
- 同一 LINE event 只能建立一個 Memo Create identity；redelivery 不得建立第二個 JSON。
- durable acceptance 不等於 Memo 完成；只有 Dropbox 檔案建立且讀回驗證後，core／Dropbox 才可標記完成。

### Core and Dropbox

- `core exactly-once`：每個 event identity 只能對應一個 `memo_id`。
- `Dropbox exactly-once`：最終檔名必須 exclusive-create；若已存在，必須驗證它就是同一 deterministic memo，再回報 duplicate/already completed，禁止覆蓋。
- 寫入順序必須是：建立唯一 identity → 建立並驗證 JSON → 以不可覆蓋方式落到 `MEMO_ACTIVE_PATH` → 讀回驗證 → 才能進入 final delivery。

### Final delivery

- final delivery 必須使用 task/event scoped durable record，API 呼叫前先寫入並讀回。
- 正常成功 final 只在 Dropbox readback PASS 後嘗試一次 Reply API。
- delivery ambiguous 時不得重試 Reply、不得立即改送 Push、不得把結果標成使用者可見成功。
- 同一 event 不得產生第二個成功 final。

## 6. Bounded ACK and Reply-first

- 保留現有 bounded HTTP ACK；ACK 只代表 LINE webhook 已安全接收，不是使用者可見的 Memo 完成訊息。
- 不使用「處理中」Push，也不以任何 Push 當作等待 Dropbox 的通知。
- Dropbox 寫入與讀回完成後立即呼叫 Reply API；不得等待到第 55 秒才回覆。
- Reply eligibility window 維持 55 秒；55 秒是最晚資格邊界，不是 delay 或排程時間。
- 此 Gate 的成功驗收必須包含 `reply_delivered`。Reply 過期、拒絕或 ambiguous 均不得由 Push 結果替代成 Gate PASS。
- Push 額度不足不得封鎖仍有效的 Reply API；有效 Reply 必須優先且獨立送出。

## 7. Deterministic fast-path implementation contract

下一個既有 N8N Gate 的實作必須同時滿足：

1. 精確命中 `備忘錄：` 後，直接進入 Memo Create deterministic fast path。
2. 不經 Codex Agent，也不由 AI 分類決定是否執行 Memo CRUD。
3. 不依賴 Monitor KV wake 才能即時產生完成回覆。
4. 每次新增只在 `MEMO_ACTIVE_PATH` 建立一個 JSON，使用唯一 `memo_id`／檔名並禁止覆蓋。
5. Dropbox 建立與 readback 完成後立即使用 Reply API 回覆，不故意等待；eligibility 仍以 55 秒為實作邊界。
6. 不傳送「處理中」Push；Push 額度狀態不得阻擋有效 Reply。
7. 同一 duplicate event 不建立第二檔，也不送第二次 final。
8. 不使用 `01_OUTBOX_完成檔案`；Create 只使用 `00_INBOX_臨時丟進來`。
9. `MEMO_ARCHIVE_PATH` 只記為未來刪除／封存位置，本 Gate 與下一個 Create 實作不得操作。
10. 不恢復通用 CRUD、Search／Modify／Delete、Calendar、Path A/B、`codex_delegate` 或 `crud_task:v1`。

## 8. Scope boundary

- 本 Gate 只產出本契約文件；不修改程式、workflow 或設定。
- 不 Deploy、Publish、啟動 Monitor、傳送 LINE、操作 KV／pending queue、commit 或 push。
- 不製作 Memo Search／Modify／Delete／Calendar，不碰 `_02`，不回頭核對新舊專案。
- 不讀取或輸出 secrets、runtime、logs、raw User ID、replyToken、credential、raw payload 或私人內容。
- `IMPLEMENTATION_READY: yes` 只表示本規格足以交給下一個既有 N8N Gate；不代表實作完成、部署完成或 live 驗收 PASS。

## 9. Gate verdict

```text
COMMAND_CONTRACT: 備忘錄：<非空內容>
LEGACY_COMPATIBILITY: report_only_existing_idea_create_not_memo
ROUTING_MODE: deterministic_fast_path_no_codex_no_ai_classification
DELIVERY_MODE: reply_api_first_immediate_after_json_readback
ACTIVE_JSON_PATH: /Users/phoebe/Library/CloudStorage/Dropbox/菲比工作總倉庫/00_INBOX_臨時丟進來
FUTURE_ARCHIVE_PATH: /Users/phoebe/Library/CloudStorage/Dropbox/菲比工作總倉庫/99_ARCHIVE_封存
JSON_SCHEMA: schema,memo_id,type=memo,content,status=active,created_at,updated_at,source=line
EMPTY_CONTENT_POLICY: reject_with_natural_error_no_json
DUPLICATE_POLICY: no_second_file_no_second_final
SECRET_POLICY: no_raw_user_id_reply_token_secret_credentials_or_raw_payload
PROCESSING_PUSH: prohibited
REPLY_ELIGIBILITY_SECONDS: 55
IMPLEMENTATION_READY: yes
FAILED_LAYER: none
LOOP_DETECTED: no
```

## 10. Next safe action

另開下一個既有Gate，由PLine｜N8N｜n8n workflow調整實作Memo Create Deterministic Fast Path。
