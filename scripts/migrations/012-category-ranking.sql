-- 012: Set default ranking for categories and establish DESC ordering convention
-- Higher sort_order = displayed first in sidebar (DESC ordering)
UPDATE categories SET sort_order = 1 WHERE sort_order = 0;
