import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LoadingSpinner from './components/LoadingSpinner';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CreatePostPage = lazy(() => import('./pages/CreatePostPage'));
const PostsPage = lazy(() => import('./pages/PostsPage'));
const PostDetailsPage = lazy(() => import('./pages/PostDetailsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SocialAccountsPage = lazy(() => import('./pages/SocialAccountsPage'));

export default function App() {
  return (
    <Router>
      <MainLayout>
        <Suspense fallback={<LoadingSpinner text="Loading view..." />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/create" element={<CreatePostPage />} />
            <Route path="/posts" element={<PostsPage />} />
            <Route path="/posts/:postId" element={<PostDetailsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/accounts" element={<SocialAccountsPage />} />
          </Routes>
        </Suspense>
      </MainLayout>
    </Router>
  );
}
