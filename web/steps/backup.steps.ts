import { Given, When } from "./support/fixtures";
import { backup } from "./support/screens/backup";

Given("Downloads has no Tortoise Spelling test files", async ({ downloads }) => {
  await backup.clearTestFiles(downloads);
});

Given(
  "Downloads has a backup {string} containing {string} and {string}",
  async ({ downloads }, filename: string, firstWord: string, secondWord: string) => {
    await backup.pushWords(downloads, filename, [
      { text: firstWord, definition: `definition of ${firstWord}` },
      { text: secondWord, definition: `definition of ${secondWord}` },
    ]);
  },
);

When("I export a backup to Downloads as {string}", async ({ page, downloads }, filename: string) => {
  await backup.export(page, downloads, filename);
});

When("I import {string} from Downloads", async ({ page, downloads }, filename: string) => {
  await backup.import(page, downloads, filename);
});
