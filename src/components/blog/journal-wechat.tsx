export function JournalWechat() {
  return (
    <section className="journal-wechat" aria-label="微信公众号 不如喝杯咖啡">
      <p className="journal-wechat-kicker">微信公众号</p>
      <p className="journal-wechat-name">不如喝杯咖啡</p>
      <div className="journal-wechat-mark">
        <div
          className="journal-wechat-qr"
          role="img"
          aria-label="微信公众号「不如喝杯咖啡」二维码"
        />
        <span className="journal-wechat-seal" aria-hidden="true">
          <img src="/journal-wechat-cat.png" width={72} height={72} alt="" />
        </span>
      </div>
    </section>
  );
}
