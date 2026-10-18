import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockTodo } from './support/mock-backend';

const writeIssue: MockTodo = {
  id: 'todo-1',
  title: 'Write the issue',
  description: 'Cover the API and the UI.',
  done: false,
  done_at: null,
  due_at: '2026-10-20T09:00:00Z',
  sort_order: 0,
  created_at: '2026-10-16T11:30:00Z',
  updated_at: '2026-10-16T11:30:00Z',
};

const shipped: MockTodo = {
  id: 'todo-2',
  title: 'Ship the release',
  description: '',
  done: true,
  done_at: '2026-10-17T08:00:00Z',
  due_at: null,
  sort_order: 1,
  created_at: '2026-10-15T09:00:00Z',
  updated_at: '2026-10-17T08:00:00Z',
};

async function openTodos(page: Page, todos: MockTodo[] = []) {
  const backend = await mockBackend(page, { session: boss, todos });
  await seedSession(page);
  await page.goto('/en/todos');
  return backend;
}

test('the sidebar links to the todo page', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en');

  await page.getByTestId('sidebar-todos-link').click();

  await expect(page).toHaveURL(/\/en\/todos$/);
  await expect(page.getByTestId('todo-page')).toBeVisible();
});

test('an empty list explains itself', async ({ page }) => {
  await openTodos(page);

  await expect(page.getByTestId('todo-page-empty')).toBeVisible();
  await expect(page.getByText('No todos yet.')).toBeVisible();
});

test('lists every todo with its notes and due date', async ({ page }) => {
  await openTodos(page, [writeIssue, shipped]);

  await expect(page.getByTestId('todo-row-todo-1')).toContainText('Write the issue');
  await expect(page.getByTestId('todo-row-todo-1')).toContainText('Cover the API and the UI.');
  await expect(page.getByTestId('todo-due-todo-1')).toBeVisible();
  await expect(page.getByTestId('todo-row-todo-2')).toContainText('Ship the release');
});

test('creating a todo posts the fields and reloads the list', async ({ page }) => {
  const backend = await openTodos(page);

  await page.locator('#todo-page-create-btn').click();
  await page.locator('#todo-title').fill('Book the dentist');
  await page.locator('#todo-description').fill('Any morning next week.');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('todo-row-todo-1')).toContainText('Book the dentist');
  expect(backend.writes).toContainEqual({ method: 'POST', path: '/todos', body: { title: 'Book the dentist', description: 'Any morning next week.', sort_order: 0 } });
});

test('a todo without a title is refused before it is sent', async ({ page }) => {
  const backend = await openTodos(page);

  await page.locator('#todo-page-create-btn').click();
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Please enter a title')).toBeVisible();
  expect(backend.writes.filter((write) => write.method !== 'GET' && write.path.startsWith('/todos'))).toEqual([]);
});

test('ticking a todo sends done and keeps the row', async ({ page }) => {
  const backend = await openTodos(page, [writeIssue]);

  await page.getByTestId('todo-row-todo-1').getByRole('checkbox').check();

  await expect(page.getByTestId('todo-row-todo-1').getByRole('checkbox')).toBeChecked();
  expect(backend.writes).toContainEqual({ method: 'PUT', path: '/todos/todo-1', body: { done: true } });
});

test('the filter asks the backend for one half of the list', async ({ page }) => {
  const backend = await openTodos(page, [writeIssue, shipped]);

  await page.getByTestId('todo-filter-done').click();

  await expect(page.getByTestId('todo-row-todo-1')).toBeHidden();
  await expect(page.getByTestId('todo-row-todo-2')).toBeVisible();
  expect(backend.requests).toContain('GET /todos?done=true');
});

test('editing a todo sends only the changed fields', async ({ page }) => {
  const backend = await openTodos(page, [writeIssue]);

  await page.getByTestId('todo-row-todo-1').getByRole('button', { name: 'Edit' }).click();
  await page.locator('#todo-title').fill('Write both issues');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('todo-row-todo-1')).toContainText('Write both issues');
  expect(backend.writes).toContainEqual({ method: 'PUT', path: '/todos/todo-1', body: { title: 'Write both issues', description: 'Cover the API and the UI.', due_at: '2026-10-20T09:00:00.000Z', sort_order: 0 } });
});

test('deleting a todo asks first and then removes the row', async ({ page }) => {
  const backend = await openTodos(page, [writeIssue]);

  await page.getByTestId('todo-row-todo-1').getByRole('button', { name: 'Delete' }).click();
  await page.locator('#todo-delete-confirm-btn').click();

  await expect(page.getByTestId('todo-page-empty')).toBeVisible();
  expect(backend.requests).toContain('DELETE /todos/todo-1');
});
