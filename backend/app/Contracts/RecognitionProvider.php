<?php

namespace App\Contracts;

use App\Data\RecognitionInput;
use App\Data\RecognitionResult;
use App\Exceptions\RecognitionProviderException;

interface RecognitionProvider
{
    /**
     * @throws RecognitionProviderException
     */
    public function recognize(RecognitionInput $input): RecognitionResult;
}
