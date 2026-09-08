export function JournalWechat() {
  return (
    <section className="blog-sidebar-section journal-wechat" aria-label="微信公众号">
      <h3 className="journal-eyebrow">
        <span aria-hidden="true" />
        微信公众号
      </h3>
      <figure className="journal-wechat-card">
        <img
          className="journal-wechat-qr"
          src="/journal-wechat-qr.png"
          width={180}
          height={180}
          alt="微信公众号「不如喝杯咖啡」二维码"
        />
        <figcaption className="journal-wechat-name">不如喝杯咖啡</figcaption>
      </figure>
    </section>
  );
}
