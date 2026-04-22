import { simpleGit } from 'simple-git';
import { broker } from '../logs/broker.js';

export async function cloneRepo(deploymentId: string, source: string, destPath: string) {
  await broker.publish(deploymentId, 'system', `Cloning ${source} into ${destPath}`);
  const git = simpleGit();
  await git.clone(source, destPath, ['--depth', '1']);
  await broker.publish(deploymentId, 'system', 'Clone complete');
}
