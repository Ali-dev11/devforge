import process from "node:process";

export function banner(message: string): void {
  console.log(`\n${message}`);
}

export function info(message: string): void {
  console.log(message);
}

export function step(message: string): void {
  console.log(`- ${message}`);
}

export function warn(message: string): void {
  console.warn(`Warning: ${message}`);
}

export function success(message: string): void {
  console.log(message);
}

export function createProgressReporter(
  label: string,
): (info: { current: number; total: number }) => void {
  let lastNonTtyPercent = -1;

  return ({ current, total }) => {
    const safeTotal = Math.max(total, 1);
    const ratio = current / safeTotal;
    const percent = Math.round(ratio * 100);

    if (process.stdout.isTTY) {
      const width = 24;
      const filled = Math.min(width, Math.round(ratio * width));
      const bar = `${"#".repeat(filled)}${"-".repeat(Math.max(width - filled, 0))}`;
      process.stdout.write(`\r- ${label}: [${bar}] ${current}/${safeTotal} (${percent}%)`);

      if (current >= safeTotal) {
        process.stdout.write("\n");
      }

      return;
    }

    if (current === 1 || current === safeTotal || percent >= lastNonTtyPercent + 20) {
      lastNonTtyPercent = percent;
      console.log(`- ${label}: ${current}/${safeTotal} (${percent}%)`);
    }
  };
}
