import './index.css';
import React from 'react';
import {Composition, staticFile} from 'remotion';
import {getVideoMetadata} from '@remotion/media-utils';
import {MyComposition, myCompSchema} from './Composition';

const FPS = 30;
const TRANSITION_DURATION = 30; // 1 segundo
const LOGO_DURATION = 150;      // 5 segundos

export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="MarketingVideo"
			component={MyComposition}
			fps={FPS}
			width={1080}
			height={1920}
			schema={myCompSchema}
			defaultProps={{
				video1DurationInFrames: 450,
				video2DurationInFrames: 450,
			}}
			calculateMetadata={async ({props}) => {
				const [meta1, meta2] = await Promise.all([
					getVideoMetadata(staticFile('video1.mov')),
					getVideoMetadata(staticFile('video2.mov')),
				]);

				const v1Frames = Math.round(meta1.durationInSeconds * FPS);
				const v2Frames = Math.round(meta2.durationInSeconds * FPS);
				const total = v1Frames + v2Frames - TRANSITION_DURATION + LOGO_DURATION;

				return {
					durationInFrames: total,
					props: {
						...props,
						video1DurationInFrames: v1Frames,
						video2DurationInFrames: v2Frames,
					},
				};
			}}
		/>
	);
};
