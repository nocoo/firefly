-- Repair denormalized taxonomy counters from published post ground truth.
UPDATE categories SET post_count = (
  SELECT COUNT(*) FROM posts
  WHERE posts.category_id = categories.id AND posts.status = 'published'
);

UPDATE tags SET post_count = (
  SELECT COUNT(*) FROM post_tags pt
  INNER JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
  WHERE pt.tag_id = tags.id
);
