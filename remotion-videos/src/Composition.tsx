import React from 'react';
import {AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {z} from 'zod';
import {LogoScene} from './Logo';

export const myCompSchema = z.object({
	video1DurationInFrames: z.number(),
	video2DurationInFrames: z.number(),
});

const TRANSITION_DURATION = 30; // 1 second cross-fade
const LOGO_DURATION = 150;      // 5 seconds

type Props = z.infer<typeof myCompSchema>;

export const MyComposition: React.FC<Props> = ({video1DurationInFrames, video2DurationInFrames}) => {
	const frame = useCurrentFrame();

	const video2StartFrame = video1DurationInFrames - TRANSITION_DURATION;
	const logoStartFrame = video2StartFrame + video2DurationInFrames;

	const video1Opacity = interpolate(
		frame,
		[video2StartFrame, video1DurationInFrames],
		[1, 0],
		{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
	);

	const video2Opacity = interpolate(
		frame,
		[video2StartFrame, video2StartFrame + TRANSITION_DURATION],
		[0, 1],
		{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
	);

	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			{/* Vídeo 1 */}
			<AbsoluteFill style={{opacity: video1Opacity}}>
				<Sequence durationInFrames={video1DurationInFrames}>
					<OffthreadVideo
						src={staticFile('video1.mov')}
						style={{width: '100%', height: '100%', objectFit: 'cover'}}
					/>
				</Sequence>
			</AbsoluteFill>

			{/* Vídeo 2 — começa durante a transição (cross-fade) */}
			<AbsoluteFill style={{opacity: video2Opacity}}>
				<Sequence from={video2StartFrame} durationInFrames={video2DurationInFrames + TRANSITION_DURATION}>
					<OffthreadVideo
						src={staticFile('video2.mov')}
						style={{width: '100%', height: '100%', objectFit: 'cover'}}
					/>
				</Sequence>
			</AbsoluteFill>

			{/* Logo Bea's Project */}
			<Sequence from={logoStartFrame} durationInFrames={LOGO_DURATION}>
				<LogoScene />
			</Sequence>
		</AbsoluteFill>
	);
};
