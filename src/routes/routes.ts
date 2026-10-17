import BaseLayout from '@/layouts/BaseLayout.vue';
import LangLayout from '@/layouts/LangLayout.vue';
import MainLayout from '@/layouts/MainLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { setMiddleware } from './middleware';
import LoginPage from '@/pages/LoginPage.vue';
import RegisterPage from '@/pages/RegisterPage.vue';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage.vue';
import ResetPasswordPage from '@/pages/ResetPasswordPage.vue';
import HomePage from '@/pages/HomePage.vue';
import SettingsPage from '@/pages/SettingsPage.vue';
import ChatPage from '@/pages/ChatPage.vue';
import WorkSpacePage from '@/pages/WorkSpacePage.vue';
import TaskPage from '@/pages/TaskPage.vue';

const routes = [
  {
    path: '/:lang/login',
    component: BaseLayout,
    children: [
      {
        path: '',
        component: LangLayout,
        children: [{ path: '', component: LoginPage, name: 'login', meta: { public: true } }],
      },
    ],
  },
  {
    path: '/:lang/register',
    component: BaseLayout,
    children: [
      {
        path: '',
        component: LangLayout,
        children: [{ path: '', component: RegisterPage, name: 'register', meta: { public: true } }],
      },
    ],
  },
  {
    path: '/:lang/forgot-password',
    component: BaseLayout,
    children: [
      {
        path: '',
        component: LangLayout,
        children: [{ path: '', component: ForgotPasswordPage, name: 'forgotPassword', meta: { public: true } }],
      },
    ],
  },
  {
    path: '/:lang/reset-password',
    component: BaseLayout,
    children: [
      {
        path: '',
        component: LangLayout,
        children: [{ path: '', component: ResetPasswordPage, name: 'resetPassword', meta: { public: true } }],
      },
    ],
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: ':lang',
        component: LangLayout,
        children: [
          { path: '', component: HomePage, name: 'home' },
          { path: 'chat/:uuid', component: ChatPage, name: 'chat' },
          { path: 'settings', component: SettingsPage, name: 'settings' },
          { path: 'workspace', component: WorkSpacePage, name: 'workspace' },
          { path: 'tasks', component: TaskPage, name: 'tasks' },
        ],
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    // always scroll to top
    return { top: 0 };
  },
});
setMiddleware(router);

export default router;
