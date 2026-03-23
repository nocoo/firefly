export function BlogFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="blog-footer">
      <span>&copy; {year} lizheng.me. All rights reserved.</span>
    </footer>
  );
}
