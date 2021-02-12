import label from '../../src/operations/label'
import {Command, Commands} from "../../src/command";
import * as github from "@actions/github";
import * as core from "@actions/core";
import nock from "nock";

const postComments = jest.fn()
const postLabels = jest.fn()
const postStatus = jest.fn()
const deleteLabels = jest.fn()

beforeAll(() => {
  jest.spyOn(core, 'getInput').mockImplementation(name => {
    return 'token'
  })

  jest.spyOn(github.context, 'repo', 'get').mockImplementation(() => {
    return {
      owner: 'owner',
      repo: 'repo'
    }
  })

  nock('https://api.github.com')
    .post('/repos/owner/repo/issues/1/comments')
    .reply(200, function (_, body) {
      postComments(body)
      return {}
    }).persist()

  nock('https://api.github.com')
    .post('/repos/owner/repo/issues/1/labels')
    .reply(200, function (_, body) {
      postLabels(body)
      return {}
    }).persist()

  nock('https://api.github.com')
    .delete(/\/repos\/owner\/repo\/issues\/1\/labels\/.+/)
    .reply(200, function (_, body) {
      const paths = this.req.path.split('/')
      deleteLabels(decodeURIComponent(paths[paths.length - 1]))
      return {}
    }).persist()

  nock('https://api.github.com')
    .post(/\/repos\/owner\/repo\/statuses\/.+/)
    .reply(200, function (_, body) {
      postStatus(body)
      return {}
    }).persist()
})

afterAll(() => {
  jest.clearAllMocks()
})

function getCommands(list: string[] = []): Commands {
  return new Commands(list.map(t => new Command((t))))
}

describe('needs', () => {
  it('should have needs/triage when needs is true', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: []
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: true
    }, getCommands())

    return expect(postLabels).toHaveBeenCalledWith({labels: ['needs/triage']})
  });

  it('should have needs/triage when needs.comment is present', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: []
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: {
        comment: 'Hello you!'
      }
    }, getCommands())

    return expect(postLabels).toHaveBeenCalledWith({labels: ['needs/triage']})
  });

  it('should have needs/triage when /needs triage is commented', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: []
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
    }, getCommands(['/needs triage']))

    return expect(postLabels).toHaveBeenCalledWith({labels: ['needs/triage']})
  });

  it('should not have needs/triage when /needs triage is commented because its already present', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'triage/accepted'}]
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
    }, getCommands(['/need triage']))

    await expect(postLabels).not.toHaveBeenCalled()
    await expect(postComments).not.toHaveBeenCalled()
    await expect(deleteLabels).not.toHaveBeenCalled()
  });

  it('should have needs/triage removed when labeled', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'needs/triage'}, {name: 'triage/accepted'}]
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted', 'rejected'],
    }, getCommands())

    await expect(postLabels).not.toHaveBeenCalled()
    await expect(postComments).not.toHaveBeenCalled()
    await expect(deleteLabels).toHaveBeenCalledWith("needs/triage")
  });

  it('should have needs/triage removed when /triage accepted', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'needs/triage'}]
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted', 'rejected'],
    }, getCommands(['/triage accepted']))

    await expect(postLabels).toHaveBeenCalledWith({labels: ['triage/accepted']})
    await expect(deleteLabels).toHaveBeenCalledWith("needs/triage")
  });

  it('should have needs/kind removed when /kind fix is commented', async function () {
    github.context.payload = {
      action: 'created',
      comment: {
        id: 1,
      },
      pull_request: {
        number: 1,
        labels: [{name: 'needs/kind'}]
      }
    }

    await label({
      prefix: 'kind',
      multiple: false,
      list: ["feature", "fix", "chore", "docs", "refactor", "dependencies"],
      needs: {
        comment: 'TEST'
      }
    }, getCommands(['/kind fix']))

    await expect(postLabels).toHaveBeenCalledWith({labels: ['kind/fix']})
    await expect(deleteLabels).toHaveBeenCalledWith("needs/kind")
  });

  it('should have needs/triage removed when /triage accepted when needs:true', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'needs/triage'}]
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted', 'rejected'],
      needs: true,
    }, getCommands(['/triage accepted']))

    await expect(postLabels).toHaveBeenCalledWith({labels: ['triage/accepted']})
    await expect(deleteLabels).toHaveBeenCalledWith("needs/triage")
  });

  it('should have needs/triage removed when /triage accepted when needs comments is available', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'needs/triage'}]
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted', 'rejected'],
      needs: {
        comment: 'available'
      },
    }, getCommands(['/triage accepted']))

    await expect(postLabels).toHaveBeenCalledWith({labels: ['triage/accepted']})
    await expect(postComments).not.toHaveBeenCalled()
    await expect(deleteLabels).toHaveBeenCalledWith("needs/triage")
  });

  it('should have needs/triage removed when /triage rejected', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'needs/triage'}]
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted', 'rejected'],
    }, getCommands(['/triage rejected']))

    await expect(postLabels).toHaveBeenCalledWith({labels: ['triage/rejected']})
    await expect(postComments).not.toHaveBeenCalled()
    await expect(deleteLabels).toHaveBeenCalledWith('needs/triage')
  });

  it('should have comment when needs/triage is present and opened', async function () {
    github.context.payload = {
      action: 'opened',
      issue: {
        number: 1,
        labels: []
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: {
        comment: 'hello you'
      }
    }, getCommands())

    await expect(postLabels).toHaveBeenCalledWith({labels: ['needs/triage']})
    await expect(postComments).toHaveBeenCalledTimes(1)
    await expect(deleteLabels).not.toHaveBeenCalled()
  });

  it('should not have comment when needs/triage is present and opened', async function () {
    github.context.payload = {
      action: 'opened',
      issue: {
        number: 1,
        labels: []
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: true
    }, getCommands())

    await expect(postLabels).toHaveBeenCalledWith({labels: ['needs/triage']})
    await expect(postComments).not.toHaveBeenCalled()
    await expect(deleteLabels).not.toHaveBeenCalled()
  });

  it('should not have comment when needs/triage is present as its edited', async function () {
    github.context.payload = {
      action: 'edited',
      issue: {
        number: 1,
        labels: []
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: {
        comment: 'hello you'
      }
    }, getCommands())

    await expect(postLabels).toHaveBeenCalledWith({labels: ['needs/triage']})
    await expect(postComments).not.toHaveBeenCalled()
    await expect(deleteLabels).not.toHaveBeenCalled()
  });

  it('should not have commented', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: []
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
    }, getCommands())

    return expect(postComments).not.toHaveBeenCalled()
  });
})

describe('labels', () => {
  it('should have removed labels with comment', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'triage/accepted'}]
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
    }, getCommands(['/triage-remove accepted']))

    await expect(postLabels).not.toHaveBeenCalled()
    await expect(deleteLabels).toHaveBeenCalledWith('triage/accepted')
  });

  it('should have added labels with comment', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'triage/accepted'}]
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted', 'a', 'b'],
    }, getCommands(['/triage a']))

    await expect(postLabels).toHaveBeenCalledWith({labels: ['triage/a']})
    await expect(postComments).not.toHaveBeenCalled()
    await expect(deleteLabels).not.toHaveBeenCalled()
  });

  it('should have added multiple labels with comment', async function () {
    github.context.payload = {
      issue: {
        number: 1,
        labels: []
      }
    }

    await label({
      prefix: 'triage',
      list: ['a', 'b', 'c'],
    }, getCommands(['/triage a c']))

    await expect(postLabels).toHaveBeenCalledWith({labels: ['triage/a', "triage/c"]})
    await expect(deleteLabels).not.toHaveBeenCalled()
  });

  describe('multiples', () => {
    it('false: should have one label', async function () {
      github.context.payload = {
        issue: {
          number: 1,
          labels: [{name: 'triage/b'}]
        }
      }

      await label({
        prefix: 'triage',
        list: ['a', 'b', 'c'],
        multiple: false
      }, getCommands(['/triage a c']))

      await expect(postLabels).toHaveBeenCalledWith({labels: ['triage/c']})
      await expect(deleteLabels).toHaveBeenCalledTimes(1)
      await expect(deleteLabels).toHaveBeenCalledWith('triage/b')
      await expect(postComments).not.toHaveBeenCalled()
    })

    it('true: should have many label', async function () {
      github.context.payload = {
        issue: {
          number: 1,
          labels: [{name: 'triage/b'}]
        }
      }

      await label({
        prefix: 'triage',
        list: ['a', 'b', 'c'],
        multiple: true
      }, getCommands(['/triage a c']))

      await expect(postLabels).toHaveBeenCalledWith({labels: ['triage/a', 'triage/c']})
      await expect(deleteLabels).not.toHaveBeenCalled()
      await expect(postComments).not.toHaveBeenCalled()
    })

    it('should have needs/triage removed when /triage accepted', async function () {
      github.context.payload = {
        issue: {
          number: 1,
          labels: [{name: 'needs/triage'}]
        }
      }

      await label({
        prefix: 'triage',
        list: ['accepted', 'rejected'],
        multiple: false,
      }, getCommands(['/triage accepted']))

      await expect(postLabels).toHaveBeenCalledWith({labels: ['triage/accepted']})
      await expect(deleteLabels).toHaveBeenCalledWith("needs/triage")
    });

    it('should have needs/triage removed when /triage accepted when needs:true', async function () {
      github.context.payload = {
        issue: {
          number: 1,
          labels: [{name: 'needs/triage'}]
        }
      }

      await label({
        prefix: 'triage',
        list: ['accepted', 'rejected'],
        needs: true,
        multiple: false,
      }, getCommands(['/triage accepted']))

      await expect(postLabels).toHaveBeenCalledWith({labels: ['triage/accepted']})
      await expect(deleteLabels).toHaveBeenCalledWith("needs/triage")
    });
  })
})

describe('status', () => {
  it('should have pending status', async () => {
    github.context.payload = {
      pull_request: {
        number: 1,
        labels: [],
        head: {
          sha: 'abc'
        }
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: {
        status: {
          context: 'Triage'
        }
      }
    }, getCommands())

    return expect(postStatus).toHaveBeenCalledWith({
      "context": "Triage",
      "state": "pending"
    })
  })

  it('should have success status', async () => {
    github.context.payload = {
      pull_request: {
        number: 1,
        labels: [],
        head: {
          sha: 'abc'
        }
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: {
        status: {
          context: 'Triage'
        }
      }
    }, getCommands(['/triage accepted']))

    return expect(postStatus).toHaveBeenCalledWith({
      "context": "Triage",
      "state": "success"
    })
  })

  it('should have failure status with description', async () => {
    github.context.payload = {
      pull_request: {
        number: 1,
        labels: [],
        head: {
          sha: 'abc'
        }
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: {
        status: {
          context: 'Triage',
          description: {
            failure: "Fail Message"
          }
        }
      }
    }, getCommands())

    return expect(postStatus).toHaveBeenCalledWith({
      "context": "Triage",
      "state": "failure"
    })
  })

  it('should have success status with description', async () => {
    github.context.payload = {
      pull_request: {
        number: 1,
        labels: [],
        head: {
          sha: 'abc'
        }
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: {
        status: {
          context: 'Triage',
          description: {
            failure: 'No',
            success: "Fail Message"
          }
        }
      }
    }, getCommands(['/triage accepted']))

    return expect(postStatus).toHaveBeenCalledWith({
      "context": "Triage",
      "state": "success",
      "description": "Fail Message",
    })
  })

  it('should not have status', async () => {
    github.context.payload = {
      pull_request: {
        number: 1,
        labels: [],
        head: {
          sha: 'abc'
        }
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: true
    }, getCommands())

    return expect(postStatus).not.toHaveBeenCalled()
  })

  it('should have url', async () => {
    github.context.payload = {
      pull_request: {
        number: 1,
        labels: [],
        head: {
          sha: 'abc'
        }
      }
    }

    await label({
      prefix: 'triage',
      list: ['accepted'],
      needs: {
        status: {
          context: 'Triage',
          url: 'https://google.com'
        }
      }
    }, getCommands())

    return expect(postStatus).toHaveBeenCalledWith({
      "context": "Triage",
      "state": "pending",
      "target_url": "https://google.com",
    })
  })
})

describe('comments flaky test', () => {
  it('should have needs/kind removed when /kind fix is commented', async () => {
    github.context.payload = {
      action: 'created',
      comment: {
        id: 1,
      },
      pull_request: {
        number: 1,
        labels: [{name: 'needs/kind'}, {name: 'kind/fix'}]
      }
    }

    await label({
      prefix: 'kind',
      multiple: false,
      list: ["feature", "fix", "chore", "docs", "refactor", "dependencies"],
      needs: {
        comment: 'TEST'
      }
    }, getCommands(['/kind fix']))

    await expect(deleteLabels).toHaveBeenCalledWith("needs/kind")
    await expect(deleteLabels).toHaveBeenCalledTimes(1)
    await expect(postLabels).not.toHaveBeenCalled()
    await expect(postComments).not.toHaveBeenCalled()
  });
})
