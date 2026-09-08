export function JournalWechat() {
  return (
    <section className="blog-sidebar-section journal-wechat" aria-label="微信公众号 不如喝杯咖啡">
      <figure className="journal-wechat-card">
        <img
          className="journal-wechat-qr"
          src="/journal-wechat-qr.png"
          width={180}
          height={180}
          alt="微信公众号「不如喝杯咖啡」二维码"
        />
        <figcaption>
          <span className="journal-wechat-name">不如喝杯咖啡</span>
          <span className="journal-wechat-hint" lang="zh">微信扫码</span>
        </figcaption>
      </figure>
    </section>
  );
}
