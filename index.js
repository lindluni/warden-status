const core = require('@actions/core')

const {Octokit} = require("@octokit/rest")
const {retry} = require("@octokit/plugin-retry");
const {throttling} = require("@octokit/plugin-throttling");
const _Octokit = Octokit.plugin(retry, throttling)

const body = core.getInput('BODY', {required: true, trimWhitespace: true}).split(' ')
const org = core.getInput('ORG', {required: true, trimWhitespace: true})
const repo = core.getInput('REPO', {required: true, trimWhitespace: true})
const issueNumber = core.getInput('ISSUE_NUMBER', {required: true, trimWhitespace: true})
const token = core.getInput('TOKEN', {required: true, trimWhitespace: true})

const client = new _Octokit({
    auth: token,
    throttle: {
        onRateLimit: (retryAfter, options, octokit) => {
            octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
            if (options.request.retryCount === 0) {
                octokit.log.info(`Retrying after ${retryAfter} seconds!`);
                return true;
            }
        },
        onAbuseLimit: (retryAfter, options, octokit) => {
            octokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`);
        },
    }

});

(async function() {
    try {
        const username = body[body.length - 1]
        const response = await client.orgs.checkMembershipForUser({
            org: org,
            username: username
        })
        switch (response.status) {
            case 204:
                await sendComment(`${username} is a member of the ${org} organization`)
                break
            case 302:
                await sendComment(`You are not authorized to make this request`)
                break
            case 404:
                await sendComment(`${username} is not a member of the ${org} organization`)
                break
            default:
                await sendComment(`Unable to determine membership for ${username}`)
                break
        }
    } catch (err) {
        await sendComment(`An error occurred while checking membership: ${err.message}`)
        core.setFailed(error.message)
    }
})()

async function sendComment(comment) {
    try {
        await client.issues.createComment({
            owner: org,
            repo: repo,
            issue_number: issueNumber,
            body: comment
        })
    } catch(err) {
        core.setFailed(err.message)
    }
}
