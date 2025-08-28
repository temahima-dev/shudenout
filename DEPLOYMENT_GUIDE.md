# 🚀 ShuDen Out - Vercel公開ガイド

## 📋 事前準備
- [x] コードの完成
- [x] Gitリポジトリ作成
- [ ] GitHubにプッシュ
- [ ] Vercelアカウント作成
- [ ] 楽天DevelopersアカウントID取得

## 🔧 Vercel公開手順

### 1. Vercelアカウント作成
1. https://vercel.com にアクセス
2. 「Continue with GitHub」でサインアップ
3. GitHubアカウントで連携

### 2. プロジェクトインポート
1. ダッシュボードで「New Project」
2. 「shudenout」リポジトリを選択
3. インポート設定:
   - **Project Name:** `shudenout`
   - **Framework:** Next.js (自動検出)
   - **Root Directory:** `./` (デフォルト)

### 3. 環境変数設定 (重要!)
Settings > Environment Variables で以下を設定:

```bash
# 楽天API (必須)
RAKUTEN_APP_ID=YOUR_RAKUTEN_APP_ID
RAKUTEN_AFFILIATE_ID=YOUR_RAKUTEN_AFFILIATE_ID

# サイトURL (本番用)
NEXT_PUBLIC_SITE_URL=https://shudenout.vercel.app

# Google Analytics (後で設定可)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### 4. デプロイ実行
1. 「Deploy」ボタンをクリック
2. 2-3分でビルド完了
3. https://shudenout.vercel.app でアクセス確認

## 🔑 楽天Developers API取得

### アカウント登録
1. https://webservice.rakuten.co.jp/ にアクセス
2. 楽天会員でログイン
3. 「アプリID発行」で新規登録

### アプリケーション登録
- **アプリケーション名:** ShuDen Out
- **アプリケーションURL:** https://shudenout.vercel.app
- **アプリケーション説明:** 終電を逃した時の緊急ホテル検索サービス
- **利用API:** 楽天トラベル

### アフィリエイト登録 (収益化)
1. https://affiliate.rakuten.co.jp/ にアクセス
2. 楽天アフィリエイト登録
3. AFFILIATE_ID取得

## ✅ 公開後チェック

### 機能テスト
- [ ] ホテル検索動作
- [ ] 現在地検索
- [ ] フィルター機能
- [ ] 楽天予約リンク
- [ ] モバイル表示

### SEOチェック
- [ ] サイトマップ: https://shudenout.vercel.app/sitemap.xml
- [ ] robots.txt: https://shudenout.vercel.app/robots.txt
- [ ] メタタグ確認
- [ ] Google Search Console登録

## 🎯 マーケティング準備

### SNS投稿例
```
🏨 ShuDen Out - 終電あとホテル をリリースしました！

✨ 終電を逃した時でも安心
📍 現在地から1km圏内のホテルを即検索
🔗 楽天トラベル連携で確実予約
📱 スマホ最適化

https://shudenout.vercel.app

#終電 #ホテル #東京 #楽天トラベル
```

### Reddit投稿例 (r/japantravel)
```
Title: [Tool] Emergency Hotel Finder for Late-Night Tokyo

I created a web app for finding nearby hotels when you miss the last train in Tokyo. It searches within 1km of your location and integrates with Rakuten Travel for booking.

Features:
- Real-time location search
- Price/amenity filters  
- Mobile optimized
- Covers Shinjuku, Shibuya, Ueno areas

https://shudenout.vercel.app

Hope this helps fellow travelers!
```

## 📊 収益化目標

### 第1フェーズ (1-3ヶ月)
- 月間ユーザー: 1,000人
- 予約件数: 50件
- 収益: 5,000-15,000円

### 第2フェーズ (3-6ヶ月)  
- 月間ユーザー: 5,000人
- 予約件数: 250件
- 収益: 25,000-75,000円

## 📞 サポート
問題が発生した場合は環境変数や楽天API設定を再確認してください。


