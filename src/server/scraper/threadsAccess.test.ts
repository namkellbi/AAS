import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasThreadsAuthCookie,
  isGenericThreadsContent,
  isGenericThreadsLoginMetadata,
  isInvalidThreadsPostRedirect,
  isThreadsLoginUrl,
  threadsUrlHasPostId
} from './threadsAccess';

test('does not treat anonymous Threads cookies as an authenticated session', () => {
  assert.equal(hasThreadsAuthCookie([
    { name: 'csrftoken', domain: '.threads.com', expires: Date.now() / 1000 + 3600 },
    { name: 'ig_did', domain: '.threads.com', expires: Date.now() / 1000 + 3600 },
    { name: 'ps_l', domain: '.threads.com', expires: Date.now() / 1000 + 3600 }
  ]), false);
});

test('accepts only a non-expired sessionid on a Threads or Instagram domain', () => {
  const future = Date.now() / 1000 + 3600;
  const past = Date.now() / 1000 - 3600;
  assert.equal(hasThreadsAuthCookie([{ name: 'sessionid', domain: '.threads.com', expires: future }]), true);
  assert.equal(hasThreadsAuthCookie([{ name: 'sessionid', domain: '.instagram.com', expires: -1 }]), true);
  assert.equal(hasThreadsAuthCookie([{ name: 'SESSIONID', domain: 'www.threads.com', expires: 0 }]), true);
  assert.equal(hasThreadsAuthCookie([{ name: 'sessionid', domain: '.threads.com', expires: past }]), false);
  assert.equal(hasThreadsAuthCookie([{ name: 'sessionid', domain: '.threads.com', expires: past }], past), false);
  assert.equal(hasThreadsAuthCookie([{ name: 'sessionid', domain: '.example.com', expires: future }]), false);
  assert.equal(hasThreadsAuthCookie([{ name: 'sessionid', domain: '.evilthreads.com', expires: future }]), false);
  assert.equal(hasThreadsAuthCookie([{ name: 'sessionid', domain: '.instagram.com.evil.test', expires: future }]), false);
});

test('recognizes login and invalid-post redirects on both Threads domains', () => {
  assert.equal(isThreadsLoginUrl('https://www.threads.com/login'), true);
  assert.equal(isThreadsLoginUrl('https://www.threads.net/login/'), true);
  assert.equal(isThreadsLoginUrl('https://www.instagram.com/accounts/login/'), true);
  assert.equal(isInvalidThreadsPostRedirect('https://www.threads.com/?error=invalid_post'), true);
  assert.equal(isInvalidThreadsPostRedirect('https://www.threads.com/?error=other'), false);
});

test('matches a post by shortcode even when the handle or Threads domain changes', () => {
  assert.equal(threadsUrlHasPostId('https://www.threads.net/@new_handle/post/ABC_123-x', 'ABC_123-x'), true);
  assert.equal(threadsUrlHasPostId('https://www.threads.com/@old_handle/post/OTHER', 'ABC_123-x'), false);
});

test('rejects generic Threads login metadata and content', () => {
  const description = 'Join Threads to share ideas, ask questions, post random thoughts, find your people and more. Log in with your Instagram.';
  assert.equal(isGenericThreadsLoginMetadata('Threads', description), true);
  assert.equal(isGenericThreadsLoginMetadata('Threads • Log in', ''), true);
  assert.equal(isGenericThreadsContent(description), true);
  assert.equal(isGenericThreadsLoginMetadata('A real post on Threads', 'Nội dung bài viết thật'), false);
});

test('does not reject a genuine post that mentions only part of the login CTA', () => {
  assert.equal(isGenericThreadsContent('My opinion: Join Threads to share ideas with friends.'), false);
  assert.equal(isGenericThreadsContent('Never log in with your Instagram on a shared computer.'), false);
});
