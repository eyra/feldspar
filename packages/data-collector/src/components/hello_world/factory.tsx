import React from 'react';
import { PromptFactory, ReactFactoryContext } from '@eyra/feldspar';
import { HelloWorld } from './component';
import { PropsUIPromptHelloWorld } from './types';

export class HelloWorldFactory implements PromptFactory {
    create(body: unknown, context: ReactFactoryContext) {
        if (this.isHelloWorld(body)) {
            return <HelloWorld {...body} {...context} />;
        }
        return null;
    }

    private isHelloWorld(body: unknown): body is PropsUIPromptHelloWorld {
        return (body as PropsUIPromptHelloWorld).__type__ === 'PropsUIPromptHelloWorld';
    }
}
