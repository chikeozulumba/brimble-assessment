import { simpleGit } from 'simple-git';
import { broker } from '../logs/broker.js';
import { config } from '../config.js';

/** Embed token for GitHub HTTPS clones when GITHUB_TOKEN is set (private repos, no TTY). */
function githubCloneUrl(source: string): string {
  const token = config.githubToken;
  if (!token) return source;
  let u: URL;
  try {
    u = new URL(source);
  } catch {
    return source;
  }
  const host = u.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') return source;
  if (u.username || u.password) return source;
  u.username = 'x-access-token';
  u.password = token;
  return u.href;
}

export async function cloneRepo(deploymentId: string, source: string, destPath: string) {
  await broker.publish(deploymentId, 'system', `Cloning ${source} into ${destPath}`);
  process.env.GIT_TERMINAL_PROMPT = '0';
  const git = simpleGit();
  await git.clone(githubCloneUrl(source), destPath, ['--depth', '1']);
  await broker.publish(deploymentId, 'system', 'Clone complete');
}
