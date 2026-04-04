export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 24 }}>プライバシーポリシー</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>最終更新日: 2026年4月4日</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>1. はじめに</h2>
        <p>
          「ポケモン ダメージ計算機」（以下「本アプリ」）は、個人開発者（以下「運営者」）が提供する非公式のポケモン対戦支援ツールです。
          本プライバシーポリシーは、本アプリおよびWebサイト（https://pokemon-damage-calc.vercel.app）における個人情報の取り扱いについて説明します。
          本アプリをご利用いただくことで、本ポリシーに同意いただいたものとみなします。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>2. 収集する情報</h2>
        <h3 style={{ fontSize: 16, fontWeight: "bold", marginTop: 16, marginBottom: 8 }}>2.1 アカウント情報</h3>
        <p>
          ログイン機能を利用する場合、メールアドレスを収集します。
          これはマジックリンク（メール認証）によるログインのためにのみ使用されます。
        </p>
        <h3 style={{ fontSize: 16, fontWeight: "bold", marginTop: 16, marginBottom: 8 }}>2.2 ポケモンデータ</h3>
        <p>
          ログインした場合、ポケモンのボックス・チーム・履歴データをサーバーに保存し、複数デバイス間で同期します。
          ログインしない場合、これらのデータはお使いのデバイス内（ローカルストレージ）にのみ保存されます。
        </p>
        <h3 style={{ fontSize: 16, fontWeight: "bold", marginTop: 16, marginBottom: 8 }}>2.3 画像データ</h3>
        <p>
          スクリーンショット読み取り機能を使用した場合、送信された画像はポケモンの認識処理にのみ使用されます。
          画像はサーバーおよび外部サービスに一切保存されず、処理完了後直ちに破棄されます。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>3. 収集しない情報</h2>
        <p>本アプリは以下の情報を一切収集しません。</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>位置情報</li>
          <li>連絡先・写真ライブラリへのアクセス</li>
          <li>広告識別子（IDFA）</li>
          <li>Cookieによるトラッキング</li>
          <li>サードパーティのアナリティクス・広告</li>
          <li>健康・フィットネスデータ</li>
          <li>財務・決済情報</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>4. データの利用目的</h2>
        <p>収集した情報は、以下の目的にのみ使用します。</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>ユーザー認証（ログイン機能の提供）</li>
          <li>ポケモンデータの保存・デバイス間同期</li>
          <li>スクリーンショットからのポケモン情報認識</li>
        </ul>
        <p style={{ marginTop: 8 }}>上記以外の目的（広告配信、マーケティング等）には一切使用しません。</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>5. 外部サービスへの委託</h2>
        <p>
          運営者は、ユーザーの個人情報を第三者に販売・貸与することはありません。
          ただし、サービスの運営に必要な業務委託先として、以下の外部サービスを利用しています。
          これらのサービスには、サービス提供に必要な範囲でのみデータが送信されます。
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li><strong>Supabase, Inc.</strong>（データベース・認証基盤）: ユーザーのアカウント情報およびポケモンデータの保存・認証処理に利用</li>
          <li><strong>Anthropic, PBC</strong>（AI画像認識）: スクリーンショットからのポケモン認識処理に利用。送信された画像は処理後直ちに破棄され、保存されません</li>
          <li><strong>Vercel, Inc.</strong>（ホスティング）: Webアプリケーションの配信に利用</li>
        </ul>
        <p style={{ marginTop: 8 }}>
          各サービスのプライバシーポリシーについては、それぞれのサービス提供元の公式サイトをご確認ください。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>6. データの保管と保存期間</h2>
        <p>
          サーバーに保存されるデータは、Supabase社が提供するクラウドサーバー上で安全に管理されます。
          通信はすべてSSL/TLSにより暗号化されています。
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 12 }}>
          <li><strong>メールアドレス・ユーザーID</strong>: アカウント削除まで保存されます</li>
          <li><strong>ポケモンデータ（ボックス・チーム・履歴）</strong>: アカウント削除まで保存されます</li>
          <li><strong>画像データ</strong>: サーバーに保存されません。認識処理完了後直ちに破棄されます</li>
          <li><strong>ローカルデータ</strong>: お使いのデバイス内にのみ保存され、ブラウザのデータ削除により消去できます</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>7. アカウントの削除</h2>
        <p>
          ユーザーはいつでもアカウントおよび関連するすべてのデータの削除を求めることができます。
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li><strong>アプリ内から削除</strong>: ログイン後、画面上部の「アカウント削除」ボタンから直接削除できます</li>
          <li><strong>お問い合わせによる削除</strong>: 下記のお問い合わせ先にご連絡いただくことでも削除可能です。原則30日以内に対応いたします</li>
        </ul>
        <p style={{ marginTop: 8 }}>
          削除されるデータには、メールアドレス、ユーザーID、サーバーに保存されたすべてのポケモンデータが含まれます。
          削除後のデータ復元はできませんのでご注意ください。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>8. 未成年者のプライバシー</h2>
        <p>
          本アプリは、13歳未満のお子様から意図的に個人情報を収集することはありません。
          13歳未満のお子様がログイン機能を利用して個人情報を提供された場合は、お問い合わせいただければ速やかに削除いたします。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>9. プライバシーポリシーの変更</h2>
        <p>
          本ポリシーは、必要に応じて改定されることがあります。
          重要な変更がある場合は、本ページにて通知いたします。
          変更後も本アプリを継続してご利用いただくことで、改定後のポリシーに同意いただいたものとみなします。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>10. お問い合わせ</h2>
        <p>
          本プライバシーポリシーに関するご質問、データ削除のご依頼は、以下までお願いいたします。
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 8, listStyle: "none" }}>
          <li>お問い合わせフォーム: <a href="https://docs.google.com/forms/d/e/1FAIpQLSeoQzIDdHm0PU47rMoS_aP45IEAr1f7iXaAdG8VX61HOwBEEw/viewform" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>こちら</a></li>
          <li>X (Twitter): <a href="https://x.com/poketool2" style={{ color: "#3b82f6" }}>@poketool2</a></li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>11. 免責事項</h2>
        <p>
          本アプリは非公式のファンメイドツールです。
          ポケットモンスター・ポケモン・Pokemonは任天堂・クリーチャーズ・ゲームフリークの登録商標です。
          当アプリは株式会社ポケモン、任天堂株式会社とは一切関係ありません。
        </p>
      </section>
    </div>
  );
}
