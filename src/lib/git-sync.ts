/**
 * Git Sync Library
 * Handles GitHub integration for pushing scripts
 */

import { Octokit } from '@octokit/rest';

const GITHUB_PAT = process.env.GITHUB_PAT;

export interface GitRepo {
    owner: string;
    repo: string;
    url: string;
    defaultBranch: string;
}

export interface PushResult {
    success: boolean;
    commitSha?: string;
    commitUrl?: string;
    error?: string;
}

/**
 * Get authenticated Octokit client
 */
function getOctokit(token?: string): Octokit {
    const pat = token || GITHUB_PAT;
    if (!pat) {
        throw new Error('GitHub PAT not configured');
    }
    return new Octokit({ auth: pat });
}

/**
 * Get or create a repository for the project
 */
export async function getOrCreateRepo(
    projectName: string,
    userEmail?: string,
    token?: string
): Promise<GitRepo | null> {
    try {
        const octokit = getOctokit(token);

        // Get authenticated user
        const { data: user } = await octokit.users.getAuthenticated();
        const owner = user.login;

        // Sanitize project name for repo
        const repoName = `mlforge-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

        // Check if repo exists
        try {
            const { data: repo } = await octokit.repos.get({ owner, repo: repoName });
            return {
                owner: repo.owner.login,
                repo: repo.name,
                url: repo.html_url,
                defaultBranch: repo.default_branch
            };
        } catch (e: any) {
            if (e.status !== 404) throw e;
        }

        // Create new repo
        const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
            name: repoName,
            description: `MLForge project: ${projectName}`,
            private: true,
            auto_init: true
        });

        console.log(`[Git] Created repo: ${newRepo.html_url}`);

        return {
            owner: newRepo.owner.login,
            repo: newRepo.name,
            url: newRepo.html_url,
            defaultBranch: newRepo.default_branch || 'main'
        };
    } catch (error: any) {
        console.error('[Git] Failed to get/create repo:', error);
        return null;
    }
}

/**
 * Push a script file to GitHub
 */
export async function pushScript(
    repo: GitRepo,
    filePath: string,
    content: string,
    commitMessage: string,
    token?: string
): Promise<PushResult> {
    try {
        const octokit = getOctokit(token);
        const { owner, repo: repoName, defaultBranch } = repo;

        // Check if file exists (to get SHA for update)
        let existingSha: string | undefined;
        try {
            const { data } = await octokit.repos.getContent({
                owner,
                repo: repoName,
                path: filePath,
                ref: defaultBranch
            });
            if (!Array.isArray(data) && data.type === 'file') {
                existingSha = data.sha;
            }
        } catch (e: any) {
            if (e.status !== 404) throw e;
            // File doesn't exist, that's okay
        }

        // Create or update file
        const { data: result } = await octokit.repos.createOrUpdateFileContents({
            owner,
            repo: repoName,
            path: filePath,
            message: commitMessage,
            content: Buffer.from(content).toString('base64'),
            branch: defaultBranch,
            sha: existingSha
        });

        console.log(`[Git] Pushed ${filePath} to ${owner}/${repoName}`);

        return {
            success: true,
            commitSha: result.commit.sha,
            commitUrl: result.commit.html_url
        };
    } catch (error: any) {
        console.error('[Git] Push failed:', error);
        return {
            success: false,
            error: error.message || 'Failed to push to GitHub'
        };
    }
}

/**
 * List commits for a file
 */
export async function getFileCommits(
    repo: GitRepo,
    filePath: string,
    token?: string
): Promise<Array<{ sha: string; message: string; date: string; author: string }>> {
    try {
        const octokit = getOctokit(token);

        const { data: commits } = await octokit.repos.listCommits({
            owner: repo.owner,
            repo: repo.repo,
            path: filePath,
            per_page: 20
        });

        return commits.map(c => ({
            sha: c.sha.substring(0, 7),
            message: c.commit.message,
            date: c.commit.author?.date || '',
            author: c.commit.author?.name || 'Unknown'
        }));
    } catch (error) {
        console.error('[Git] Failed to get commits:', error);
        return [];
    }
}
