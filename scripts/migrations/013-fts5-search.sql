-- 013: FTS5 full-text search index for posts
--
-- Application-layer CJK segmentation via Intl.Segmenter writes pre-segmented
-- text into this table. unicode61 tokenizer splits on spaces (sufficient for
-- pre-segmented input). Default stored mode enables snippet()/highlight().

CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  title,
  content,
  excerpt,
  tokenize='unicode61 remove_diacritics 2'
);
