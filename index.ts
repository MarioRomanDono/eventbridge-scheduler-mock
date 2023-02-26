import express from 'express';
import ajv from 'ajv';
import createScheduleSchema from './schemas/createSchedule.json';
import { randomUUID } from 'crypto';
import moment from 'moment';

const app = express(),
    port = 3000,
    schedules = new Map<string, any>();

app.use(express.json());
app.use(function(_req, res, next) {
    res.setHeader('x-amzn-RequestId', randomUUID());
    next();
});

app.delete('/schedules/:name', (req, res) => {
    const scheduleName = req.params.name,
        validationErrors: Array<string> = [];

    if (scheduleName.length > 64) {
        validationErrors.push(`Value ${scheduleName} at 'name' failed to satisfy constraint: Member must have length less than or equal to 64`);
    }

    if (!scheduleName.match(/^[0-9a-zA-Z-_.]+$/)) {
        validationErrors.push(`Value ${scheduleName} at 'name' failed to satisfy constraint: Member must satisfy regular expression pattern: [0-9a-zA-Z-_.]+`);
    }

    if (validationErrors.length > 0) {
        const numberOfErrors = validationErrors.length;
        res.status(400).json({
            'code': 'ValidationException',
            'message': `${numberOfErrors} validation ${numberOfErrors === 1 ? 'error' : 'errors'} detected: ${validationErrors.join('; ')}`
        });
        return;
    }

    if (!schedules.has(scheduleName)) {
        res.status(404).json({
            'code': 'ResourceNotFoundException',
            'message': `Schedule ${scheduleName} does not exist.`
        });
        return;
    }

    schedules.delete(scheduleName);

    res.send();
});

app.post('/schedules/:name', (req, res) => {
    const scheduleName = req.params.name;

    if (schedules.has(scheduleName)) {
        res.status(409).json({
            'code': 'ConflictException',
            'message': `Schedule ${scheduleName} already exists.`
        });
        return;
    }

    const validationErrors: Array<string> = [];

    if (scheduleName.length > 64) {
        validationErrors.push(`Value ${scheduleName} at 'name' failed to satisfy constraint: Member must have length less than or equal to 64`);
    }

    if (!scheduleName.match(/^[0-9a-zA-Z-_.]+$/)) {
        validationErrors.push(`Value ${scheduleName} at 'name' failed to satisfy constraint: Member must satisfy regular expression pattern: [0-9a-zA-Z-_.]+`);
    }    
    
    const {ClientToken, ...scheduleBody} = req.body,
        validate = new ajv({allErrors: true}).compile(createScheduleSchema),
        isValidScheduleBody = validate(scheduleBody);

    if (!isValidScheduleBody) {
        console.log(validate.errors);
        const errorMessages = validate.errors!.map(error => error.message!);
        validationErrors.push(...errorMessages);
    }

    if (validationErrors.length > 0) {
        const numberOfErrors = validationErrors.length;
        res.status(400).json({
            'code': 'ValidationException',
            'message': `${numberOfErrors} validation ${numberOfErrors === 1 ? 'error' : 'errors'} detected: ${validationErrors.join('; ')}`
        });
        return;
    }

    const schedule = createSchedule(scheduleName, scheduleBody);

    schedules.set(scheduleName, schedule);
    
    res.json({'ScheduleArn': schedule.Arn});
});

function createSchedule(scheduleName: string, scheduleBody: any) {
    const currentDate = moment().toISOString(true);
    return {
        Arn: `arn:aws:scheduler:eu-west-1:000000000000:schedule/default/${scheduleName}`,
        CreationDate: currentDate,
        LastModificationDate: currentDate,
        GroupName: 'default',
        State: 'ENABLED',
        ScheduleExpressionTimezone: 'UTC',
        Name: scheduleName,
        ...scheduleBody,
        Target: {
            RetryPolicy: {
                'MaximumEventAgeInSeconds': 86400,
                'MaximumRetryAttempts': 185
            },
            ...scheduleBody.Target
        }
    }
}

app.listen(port);