import { createReadStream, existsSync } from 'fs';
import { createInterface } from 'readline';

export interface LogLine {
  id: number;
  deploymentId: string;
  ts: string;
  stream: string;
  line: string;
}

export async function readLogFile(
  deploymentId: string,
  logPath: string,
  afterId = 0,
): Promise<LogLine[]> {
  if (!existsSync(logPath)) return [];

  const result: LogLine[] = [];
  let lineNum = 0;

  const rl = createInterface({
    input: createReadStream(logPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const raw of rl) {
    if (!raw) continue;
    lineNum++;
    if (lineNum <= afterId) continue;

    const t1 = raw.indexOf('\t');
    const t2 = raw.indexOf('\t', t1 + 1);
    if (t1 === -1 || t2 === -1) continue;

    result.push({
      id: lineNum,
      deploymentId,
      ts: raw.slice(0, t1),
      stream: raw.slice(t1 + 1, t2),
      line: raw.slice(t2 + 1),
    });
  }

  return result;
}
